/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sendBotMessage } from "@api/Commands";
import { ChannelStore, MessageStore, moment, SnowflakeUtils } from "@webpack/common";

import { settings } from "./settings";
import { getTypedFor } from "./store";

const NOTE_AUTHOR = "Left on Read";

function noteId(ts: number) {
    return SnowflakeUtils.fromTimestamp(ts);
}

/** drop a local-only message into the DM: "@them was typing here at 8:41 PM" */
export function injectNote(channelId: string, userId: string, ts: number) {
    if (!settings.store.chatNotes) return;
    const id = noteId(ts);
    if (MessageStore.getMessage(channelId, id)) return;
    sendBotMessage(channelId, {
        id,
        timestamp: new Date(ts).toISOString() as any,
        content: `<@${userId}> was typing here at ${moment(ts).format("LT")}`,
        author: { username: NOTE_AUTHOR, bot: true } as any
    });
}

/** notes are local, so put them back when the DM is (re)opened */
export function reinjectNotes(channelId: string) {
    if (!settings.store.chatNotes) return;
    const channel = ChannelStore.getChannel(channelId);
    if (!channel?.isDM()) return;
    const userId = channel.getRecipientId();
    if (!userId) return;
    for (const ts of getTypedFor(channelId)) injectNote(channelId, userId, ts);
}
