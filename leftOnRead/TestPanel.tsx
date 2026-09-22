/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Paragraph } from "@components/Paragraph";
import { ChannelStore, FluxDispatcher, SelectedChannelStore, UserStore, useStateFromStores } from "@webpack/common";

import { useGhostVersion } from "../ghosted/store";
import { awaitingMsg, getRadar } from "./store";

export const TestPanel = ErrorBoundary.wrap(function TestPanel() {
    useGhostVersion();
    const channelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getChannelId());
    const channel = channelId ? ChannelStore.getChannel(channelId) : null;
    const isDm = !!channel?.isDM?.();
    const other = isDm ? UserStore.getUser(channel!.getRecipientId()!) : null;
    const waiting = isDm ? awaitingMsg(channelId!) : null;
    const radar = isDm ? getRadar(channelId!) : null;
    const silentTyping = isPluginEnabled("SilentTyping");

    let status: string;
    if (!isDm) status = "Open a DM first, then come back here.";
    else if (!waiting) status = `${other?.globalName ?? other?.username ?? "They"} sent the last message, so it's your turn. The eye only watches DMs where you spoke last.`;
    else if (radar) status = `Watching ${other?.globalName ?? other?.username}. ${radar.typed.length} typing burst${radar.typed.length === 1 ? "" : "s"}, online ${radar.online.length} time${radar.online.length === 1 ? "" : "s"} since your message.`;
    else status = `Watching ${other?.globalName ?? other?.username}, nothing seen yet.`;

    return (
        <div>
            <Paragraph>{status}</Paragraph>
            {silentTyping && (
                <Paragraph style={{ color: "var(--text-warning, #f0b232)" }}>
                    SilentTyping is enabled on this client. Other people never see you type, so their LeftOnRead can't react to you.
                </Paragraph>
            )}
            <Button
                size="small"
                variant="secondary"
                disabled={!isDm || !waiting}
                onClick={() => FluxDispatcher.dispatch({ type: "TYPING_START", channelId, userId: channel!.getRecipientId() })}
            >
                Simulate them typing in this DM
            </Button>
            <Paragraph style={{ opacity: 0.7, marginTop: "0.4em" }}>
                Fires the same event Discord sends when they type. You should get the red eye on the DM row and a note in the chat.
            </Paragraph>
        </div>
    );
}, { noop: true });
