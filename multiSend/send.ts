/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sendMessage } from "@utils/discord";
import { User } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore } from "@webpack/common";

const PrivateChannelActions = findByPropsLazy("ensurePrivateChannel") as { ensurePrivateChannel(userId: string): Promise<string>; };
const TypingActions = findByPropsLazy("startTyping", "stopTyping") as { startTyping(channelId: string): void; stopTyping(channelId: string): void; };

export interface SendOptions {
    /** seconds */
    minDelay: number;
    maxDelay: number;
    /** show the typing indicator for a while before each message */
    typeFirst: boolean;
}

export interface Progress {
    done: number;
    total: number;
    current?: string;
    failed: string[];
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); rej(new Error("cancelled")); }, { once: true });
});

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function displayName(u: User) {
    return (u as any).globalName ?? u.username;
}

/** pick a variant (blocks separated by a line that is just ---) and fill placeholders */
export function render(template: string, user: User) {
    const variants = template.split(/\n\s*---\s*\n/).map(v => v.trim()).filter(Boolean);
    const text = variants[Math.floor(Math.random() * variants.length)] ?? "";
    const name = displayName(user);
    return text
        .replaceAll("{name}", name)
        .replaceAll("{first}", name.split(/\s+/)[0])
        .replaceAll("{username}", u => u === "{username}" ? user.username : u);
}

/** typing time a person would plausibly need for this text, capped */
function typingMs(text: string) {
    return Math.min(1200 + text.length * rand(45, 80), 6000);
}

export async function sendToMany(
    recipients: User[],
    template: string,
    opts: SendOptions,
    onProgress: (p: Progress) => void,
    signal: AbortSignal
) {
    const progress: Progress = { done: 0, total: recipients.length, failed: [] };
    for (const user of recipients) {
        if (signal.aborted) break;
        progress.current = displayName(user);
        onProgress({ ...progress });
        try {
            const channelId = ChannelStore.getDMFromUserId(user.id) ?? await PrivateChannelActions.ensurePrivateChannel(user.id);
            const content = render(template, user);
            if (progress.done > 0) await sleep(rand(opts.minDelay, opts.maxDelay) * 1000, signal);
            if (opts.typeFirst) {
                TypingActions.startTyping(channelId);
                await sleep(typingMs(content), signal);
            }
            await sendMessage(channelId, { content });
            if (opts.typeFirst) TypingActions.stopTyping(channelId);
        } catch (e: any) {
            if (e?.message === "cancelled") break;
            progress.failed.push(displayName(user));
        }
        progress.done++;
        onProgress({ ...progress });
    }
    progress.current = undefined;
    onProgress({ ...progress });
    return progress;
}
