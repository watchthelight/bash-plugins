/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addProfileBadge, removeProfileBadge } from "@api/Badges";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";
import definePlugin from "@utils/types";
import { Channel, Message } from "@vencord/discord-types";
import { ChannelStore, Menu, MessageStore, UserStore } from "@webpack/common";

import { AUTHOR_ID, DeveloperBadge } from "./badge";
import { GhostBadge } from "./GhostBadge";
import { settings } from "./settings";
import * as Store from "./store";

const DECORATOR_ID = "Ghosted";
const SNOOZE_MS = 24 * 3600e3;

let tickTimer: ReturnType<typeof setInterval> | null = null;

const userContextPatch: NavContextMenuPatchCallback = (children, props: { channel?: Channel; }) => {
    // "user-context" also fires from message avatars / member list / friends list
    const { channel } = props;
    if (!channel?.isDM?.()) return;
    if (!Store.getGhost(channel.id)) return;

    const group = findGroupChildrenByChildId("close-dm", children);
    if (!group) return;

    group.unshift(
        <Menu.MenuItem
            id="vc-ghosted-dismiss"
            label="Not ghosting"
            action={() => Store.markHandled(channel.id, "dismiss")}
        />,
        <Menu.MenuItem
            id="vc-ghosted-snooze"
            label="Snooze ghost 24h"
            action={() => Store.snooze(channel.id, SNOOZE_MS)}
        />
    );
};

export default definePlugin({
    name: "Ghosted",
    description: "Flags DMs you've read but never replied to, so 'I'll answer later' doesn't turn into never",
    authors: [{ name: "watchthelight", id: BigInt(AUTHOR_ID) }],
    tags: ["Friends", "Notifications"],
    dependencies: ["MemberListDecoratorsAPI", "ContextMenuAPI", "BadgeAPI"],
    settings,

    contextMenus: {
        "user-context": userContextPatch
    },

    flux: {
        MESSAGE_CREATE({ message, optimistic }: { message: Message; optimistic: boolean; }) {
            if (optimistic || !message?.author) return;
            if (!Store.isDmChannel(message.channel_id)) return;
            Store.record(message.channel_id, message);
        },

        MESSAGE_DELETE({ channelId, id }: { channelId: string; id: string; }) {
            if (Store.getEntry(channelId)?.lastMsgId !== id) return;
            Store.remove(channelId);
            const cached = MessageStore.getLastMessage(channelId);
            if (cached) Store.record(channelId, cached);
            else if (settings.store.bootstrapCount > 0) Store.enqueueFetch(channelId);
        },

        MESSAGE_REACTION_ADD({ channelId, userId }: { channelId: string; userId: string; }) {
            if (!settings.store.reactionCountsAsReply) return;
            if (userId !== UserStore.getCurrentUser()?.id) return;
            if (!Store.isDmChannel(channelId)) return;
            Store.markHandled(channelId, "reaction");
        },

        MESSAGE_REACTION_REMOVE({ channelId, userId }: { channelId: string; userId: string; }) {
            if (userId !== UserStore.getCurrentUser()?.id) return;
            Store.clearReactionHandled(channelId);
        },

        LOAD_MESSAGES_SUCCESS({ channelId, messages, isBefore, isAfter }: { channelId: string; messages: Message[]; isBefore?: boolean; isAfter?: boolean; }) {
            if (isBefore || isAfter || !messages?.length) return;
            if (!Store.isDmChannel(channelId)) return;
            let newest = messages[0];
            for (const m of messages) if (BigInt(m.id) > BigInt(newest.id)) newest = m;
            Store.record(channelId, newest);
        },

        CONNECTION_OPEN() {
            Store.bootstrap();
        }
    },

    async start() {
        await Store.load();

        addMemberListDecorator(DECORATOR_ID, ({ channel }) => channel ? <GhostBadge channelId={channel.id} /> : null, "dms");
        addProfileBadge(DeveloperBadge);

        tickTimer = setInterval(Store.tick, 60e3);

        // cold boot: stores aren't populated yet, CONNECTION_OPEN will run bootstrap.
        // toggled on in a running client: CONNECTION_OPEN already fired, run it now.
        if (ChannelStore.getSortedPrivateChannels().length > 0) Store.bootstrap();
    },

    stop() {
        removeMemberListDecorator(DECORATOR_ID);
        removeProfileBadge(DeveloperBadge);
        if (tickTimer) {
            clearInterval(tickTimer);
            tickTimer = null;
        }
        void Store.flush();
    }
});
