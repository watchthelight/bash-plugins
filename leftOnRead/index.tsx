/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";
import definePlugin from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { ChannelStore, Menu, UserStore } from "@webpack/common";

import { isDmChannel } from "../ghosted/store";
import { RadarBadge } from "./Badge";
import { settings } from "./settings";
import * as Store from "./store";

const DECORATOR_ID = "LeftOnRead";
let tickTimer: ReturnType<typeof setInterval> | null = null;

/** DM channel id for a user, only if that DM is currently waiting on their reply */
function awaitingDmFor(userId: string) {
    const channelId = ChannelStore.getDMFromUserId(userId);
    return channelId && Store.awaitingMsg(channelId) ? channelId : null;
}

const userContextPatch: NavContextMenuPatchCallback = (children, props: { channel?: Channel; }) => {
    const { channel } = props;
    if (!channel?.isDM?.()) return;
    if (!Store.getRadar(channel.id)) return;
    const group = findGroupChildrenByChildId("close-dm", children);
    group?.unshift(
        <Menu.MenuItem
            id="vc-lor-dismiss"
            label="Stop watching for a reply"
            action={() => Store.dismiss(channel.id)}
        />
    );
};

export default definePlugin({
    name: "LeftOnRead",
    description: "Shows when someone saw your DM and didn't answer: they started typing and never sent, or came online after your message",
    authors: [{ name: "watchthelight", id: 697169405422862417n }],
    tags: ["Friends"],
    // Ghosted's store knows who sent the last message in every DM; this plugin reads it
    dependencies: ["Ghosted", "MemberListDecoratorsAPI", "ContextMenuAPI"],
    settings,

    contextMenus: {
        "user-context": userContextPatch
    },

    flux: {
        TYPING_START(e: { channelId?: string; channel_id?: string; userId?: string; user_id?: string; }) {
            const channelId = e.channelId ?? e.channel_id;
            const userId = e.userId ?? e.user_id;
            if (!channelId || !userId || userId === UserStore.getCurrentUser()?.id) return;
            if (!isDmChannel(channelId)) return;
            if (!Store.awaitingMsg(channelId)) return;
            Store.recordTyping(channelId);
        },

        PRESENCE_UPDATES(e: { updates?: { user?: { id: string; }; status?: string; }[]; }) {
            if (!settings.store.showPresence || !e?.updates) return;
            for (const u of e.updates) {
                const id = u.user?.id;
                if (!id || !u.status || u.status === "offline" || u.status === "invisible") continue;
                const channelId = awaitingDmFor(id);
                if (channelId) Store.recordOnline(channelId);
            }
        },

        MESSAGE_REACTION_ADD({ channelId, userId }: { channelId: string; userId: string; }) {
            if (!channelId || !userId || userId === UserStore.getCurrentUser()?.id) return;
            if (!isDmChannel(channelId) || !Store.awaitingMsg(channelId)) return;
            Store.recordReaction(channelId);
        }
    },

    async start() {
        await Store.load();
        addMemberListDecorator(DECORATOR_ID, ({ channel }) => channel ? <RadarBadge channelId={channel.id} /> : null, "dms");
        tickTimer = setInterval(Store.tick, 60e3);
    },

    stop() {
        removeMemberListDecorator(DECORATOR_ID);
        if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        void Store.flush();
    }
});
