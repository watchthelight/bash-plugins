/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addChatBarButton, ChatBarButton, removeChatBarButton } from "@api/ChatButtons";
import { ApplicationCommandInputType } from "@api/Commands";
import definePlugin from "@utils/types";

import { openMultiSendModal } from "./MultiSendModal";
import { settings } from "./settings";

const BUTTON_ID = "MultiSend";

function Icon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 4.5 21 12 3 19.5v-6l12-1.5L3 10.5v-6zm6 1.2v3.3l7.2 1.2L9 11.4v3.3L16.6 12 9 5.7z" />
        </svg>
    );
}

export default definePlugin({
    name: "MultiSend",
    description: "Send one message (with variants and names filled in) to several DMs, spaced out like a person would",
    authors: [{ name: "watchthelight", id: 697169405422862417n }],
    tags: ["Friends"],
    dependencies: ["ChatInputButtonAPI", "CommandsAPI"],
    settings,

    commands: [{
        name: "multisend",
        description: "Send a message to several people",
        inputType: ApplicationCommandInputType.BUILT_IN,
        execute: () => { openMultiSendModal(); }
    }],

    start() {
        addChatBarButton(BUTTON_ID, ({ isMainChat }) => isMainChat
            ? <ChatBarButton tooltip="Send to several people" onClick={openMultiSendModal}><Icon /></ChatBarButton>
            : null, Icon);
    },

    stop() {
        removeChatBarButton(BUTTON_ID);
    }
});
