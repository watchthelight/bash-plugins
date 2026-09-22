/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { React, UserStore } from "@webpack/common";

import * as Ghosted from "../ghosted/store";
import { settings } from "./settings";

/** what the other person did since your last message */
export interface Signals {
    /** the message of yours these signals belong to; a new message from you resets them */
    forMsgId: string;
    /** ms start times of typing bursts from them that never became a message */
    typedAt: number[];
    /** last TYPING_START seen, to tell a continuing burst from a new one */
    typedLastSeen?: number;
    /** ms timestamps of them coming online (any non-offline status) */
    onlineAt: number[];
    /** they reacted to something in the DM */
    reactedAt?: number;
    dismissed?: boolean;
}

const KEY = "LeftOnRead_state";
const state = new Map<string, Signals>();
const listeners = new Set<() => void>();
let version = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => void listeners.delete(cb);
}
function emit() {
    version++;
    for (const l of listeners) l();
}
const getVersion = () => version;
export function useRadarVersion() {
    return React.useSyncExternalStore(subscribe, getVersion);
}
export const tick = emit;

export async function load() {
    const saved = await DataStore.get<Record<string, Signals>>(KEY);
    state.clear();
    if (saved) for (const [k, v] of Object.entries(saved)) state.set(k, v);
    emit();
}
export function flush() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    return DataStore.set(KEY, Object.fromEntries(state));
}
function changed() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 500);
    emit();
}

/** the message of yours we're waiting on, or null if it isn't your turn to wait */
export function awaitingMsg(channelId: string) {
    const e = Ghosted.getEntry(channelId);
    const me = UserStore.getCurrentUser()?.id;
    if (!e || !me || e.lastAuthorId !== me) return null;
    return e;
}

/** signals for the current awaiting message, resetting stale ones from an older message */
function current(channelId: string, create: boolean): Signals | null {
    const e = awaitingMsg(channelId);
    if (!e) return null;
    let s = state.get(channelId);
    if (!s || s.forMsgId !== e.lastMsgId) {
        if (!create) return null;
        s = { forMsgId: e.lastMsgId, typedAt: [], onlineAt: [] };
        state.set(channelId, s);
    }
    return s;
}

/** returns the burst start time when this is a new typing burst, else null */
export function recordTyping(channelId: string): number | null {
    const s = current(channelId, true);
    if (!s) return null;
    const now = Date.now();
    // Discord re-sends TYPING_START every ~10s while typing; collapse a burst into one event.
    // the stored time is the burst start, so the chat note keeps its place
    const last = s.typedAt[s.typedAt.length - 1];
    if (last && now - (s.typedLastSeen ?? last) < 15_000) {
        s.typedLastSeen = now;
        changed();
        return null;
    }
    s.typedAt.push(now);
    s.typedLastSeen = now;
    changed();
    return now;
}

/** typing burst start times for the message currently awaiting a reply */
export function getTypedFor(channelId: string): number[] {
    const s = current(channelId, false);
    return s ? s.typedAt : [];
}

export function recordOnline(channelId: string) {
    const s = current(channelId, true);
    if (!s) return;
    const now = Date.now();
    if (s.onlineAt.length && now - s.onlineAt[s.onlineAt.length - 1] < 60_000) return;
    s.onlineAt.push(now);
    changed();
}

export function recordReaction(channelId: string) {
    const s = current(channelId, true);
    if (!s) return;
    s.reactedAt = Date.now();
    changed();
}

export function dismiss(channelId: string) {
    const s = current(channelId, true);
    if (!s) return;
    s.dismissed = true;
    changed();
}

export function getEntry(channelId: string) {
    return state.get(channelId);
}

export interface Radar {
    /** ms when you sent the message they haven't answered */
    sentAt: number;
    typed: number[];
    online: number[];
    reactedAt?: number;
}

export function getRadar(channelId: string): Radar | null {
    const e = awaitingMsg(channelId);
    if (!e) return null;
    const s = state.get(channelId);
    if (s?.forMsgId === e.lastMsgId && s.dismissed) return null;
    if (settings.store.reactionClears && s?.forMsgId === e.lastMsgId && s.reactedAt) return null;
    if (Date.now() - e.lastMsgTs < settings.store.minAgeMinutes * 60e3) return null;

    const typed = s?.forMsgId === e.lastMsgId ? s.typedAt : [];
    const online = s?.forMsgId === e.lastMsgId ? s.onlineAt : [];
    const hasSignal = (settings.store.showTyping && typed.length > 0) || (settings.store.showPresence && online.length > 0);
    if (settings.store.onlyWithSignal && !hasSignal) return null;

    return { sentAt: e.lastMsgTs, typed, online, reactedAt: s?.reactedAt };
}
