/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { ChannelStore, Constants, MessageStore, React, ReadStateStore, RestAPI, UserStore } from "@webpack/common";

import { settings } from "./settings";

export interface Entry {
    /** last message in the DM we know about */
    lastMsgId: string;
    lastAuthorId: string;
    /** ms, derived from the snowflake */
    lastMsgTs: number;
    /** set by reaction / dismiss; ghost re-arms when they send again */
    handledMsgId?: string;
    handledBy?: "reaction" | "dismiss";
    /** ms */
    snoozeUntil?: number;
}

interface MessageLike {
    id: string;
    author: { id: string; };
}

const KEY = "Ghosted_state";
const logger = new Logger("Ghosted");

const state = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const snowflakeToMs = (id: string) => Number(BigInt(id) >> 22n) + 1420070400000;

/* ---------- subscription ---------- */

export function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => void listeners.delete(cb);
}

function emit() {
    version++;
    for (const l of listeners) l();
}

const getVersion = () => version;

/** re-renders the caller whenever ghost state changes (or the minute tick fires) */
export function useGhostVersion() {
    return React.useSyncExternalStore(subscribe, getVersion);
}

/** external tick so ages re-evaluate without state changes */
export const tick = emit;

/* ---------- persistence ---------- */

export async function load() {
    const saved = await DataStore.get<Record<string, Entry>>(KEY);
    state.clear();
    if (saved) for (const [k, v] of Object.entries(saved)) state.set(k, v);
    emit();
}

export function flush() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    return DataStore.set(KEY, Object.fromEntries(state));
}

function changed() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 500);
    emit();
}

/* ---------- mutations ---------- */

export function record(channelId: string, msg: MessageLike) {
    const prev = state.get(channelId);
    if (prev?.lastMsgId === msg.id) return;
    // never move backwards (a late LOAD_MESSAGES_SUCCESS must not clobber a newer MESSAGE_CREATE)
    if (prev && BigInt(prev.lastMsgId) > BigInt(msg.id)) return;

    state.set(channelId, {
        lastMsgId: msg.id,
        lastAuthorId: msg.author.id,
        lastMsgTs: snowflakeToMs(msg.id)
    });
    changed();
}

export function remove(channelId: string) {
    if (state.delete(channelId)) changed();
}

export function markHandled(channelId: string, by: Entry["handledBy"]) {
    const e = state.get(channelId);
    if (!e || (e.handledMsgId === e.lastMsgId && e.handledBy === by)) return;
    e.handledMsgId = e.lastMsgId;
    e.handledBy = by;
    changed();
}

/** un-reacting re-arms the ghost, but never undoes a manual dismiss */
export function clearReactionHandled(channelId: string) {
    const e = state.get(channelId);
    if (!e || e.handledBy !== "reaction" || e.handledMsgId !== e.lastMsgId) return;
    delete e.handledMsgId;
    delete e.handledBy;
    changed();
}

export function snooze(channelId: string, ms: number) {
    const e = state.get(channelId);
    if (!e) return;
    e.snoozeUntil = Date.now() + ms;
    changed();
}

export function getEntry(channelId: string) {
    return state.get(channelId);
}

/* ---------- query ---------- */

export interface Ghost {
    /** ms timestamp of their unanswered message */
    since: number;
}

export function getGhost(channelId: string): Ghost | null {
    const e = state.get(channelId);
    if (!e) return null;

    const me = UserStore.getCurrentUser()?.id;
    if (!me || e.lastAuthorId === me) return null;
    if (e.handledMsgId === e.lastMsgId) return null;
    if (e.snoozeUntil && e.snoozeUntil > Date.now()) return null;
    if (settings.store.ignoreBots && UserStore.getUser(e.lastAuthorId)?.bot) return null;

    if (!settings.store.includeUnread) {
        // right after (re)connect read state is a client guess; don't flag on a guess
        if (ReadStateStore.isEstimated(channelId)) return null;
        const ack = ReadStateStore.ackMessageId(channelId);
        if (!ack || BigInt(ack) < BigInt(e.lastMsgId)) return null;
    }

    if (Date.now() - e.lastMsgTs < settings.store.thresholdHours * 3600e3) return null;

    return { since: e.lastMsgTs };
}

/** ghosted DMs first (longest-ghosted at top), everyone else in Discord's original order */
export function sortIds(ids: string[]): string[] {
    if (!settings.store.sortActive || !Array.isArray(ids)) return ids;

    const ghosted: { id: string; since: number; }[] = [];
    const rest: string[] = [];
    for (const id of ids) {
        const g = getGhost(id);
        if (g) ghosted.push({ id, since: g.since });
        else rest.push(id);
    }
    if (ghosted.length === 0) return ids;

    ghosted.sort((a, b) => a.since - b.since);
    return [...ghosted.map(g => g.id), ...rest];
}

export function getGhostCount() {
    let n = 0;
    for (const id of state.keys()) if (getGhost(id)) n++;
    return n;
}

/* ---------- REST fetch queue (bootstrap + delete fallback) ---------- */

const queue: string[] = [];
const queued = new Set<string>();
let running = false;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function enqueueFetch(channelId: string) {
    if (queued.has(channelId)) return;
    queued.add(channelId);
    queue.push(channelId);
    void runQueue();
}

async function runQueue() {
    if (running) return;
    running = true;
    try {
        while (queue.length) {
            const id = queue.shift()!;
            queued.delete(id);
            await fetchLast(id);
            await sleep(300);
        }
    } finally {
        running = false;
    }
}

async function fetchLast(channelId: string) {
    try {
        const res = await RestAPI.get({
            url: Constants.Endpoints.MESSAGES(channelId),
            query: { limit: 1 },
            retries: 2
        });
        const msg: MessageLike | undefined = res?.body?.[0];
        if (msg) record(channelId, msg);
        else remove(channelId);
    } catch (e: any) {
        if (e?.status === 429) {
            const retryAfter = Number(e?.body?.retry_after ?? 1);
            logger.warn(`rate limited fetching ${channelId}, retrying in ${retryAfter}s`);
            await sleep(retryAfter * 1000 + 100);
            enqueueFetch(channelId);
        } else {
            logger.warn(`failed to fetch last message for ${channelId}`, e);
        }
    }
}

/* ---------- bootstrap ---------- */

/**
 * Bring state up to date with ChannelStore's lastMessageId for every DM.
 * Cached messages are free; the N most recent unknowns are fetched over REST.
 * Idempotent — the queue dedupes by channel.
 */
export function bootstrap() {
    const dms = ChannelStore.getSortedPrivateChannels()
        .filter(c => c.isDM() && !c.isSystemDM() && c.lastMessageId);

    let restBudget = settings.store.bootstrapCount;

    for (const c of dms) {
        const entry = state.get(c.id);
        if (entry?.lastMsgId === c.lastMessageId) continue;

        const cached = MessageStore.getLastMessage(c.id);
        if (cached?.id === c.lastMessageId) {
            record(c.id, cached);
            continue;
        }

        if (restBudget > 0) {
            restBudget--;
            enqueueFetch(c.id);
        }
    }
}

export function isDmChannel(channelId: string) {
    const c = ChannelStore.getChannel(channelId);
    return !!c && c.isDM() && !c.isSystemDM();
}
