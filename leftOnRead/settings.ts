/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    minAgeMinutes: {
        description: "Minutes your message has to sit unanswered before the radar shows anything",
        type: OptionType.SLIDER,
        markers: [0, 15, 30, 60, 120, 240, 480],
        default: 30,
        stickToMarkers: false
    },
    showTyping: {
        description: "Track when they start typing in your DM and never send",
        type: OptionType.BOOLEAN,
        default: true
    },
    showPresence: {
        description: "Track when they come online after your message (friends only, Discord hides presence otherwise)",
        type: OptionType.BOOLEAN,
        default: true
    },
    onlyWithSignal: {
        description: "Only show the badge once there is a typing or online signal. Off shows every DM waiting on a reply",
        type: OptionType.BOOLEAN,
        default: true
    },
    reactionClears: {
        description: "A reaction from them counts as a reply and hides the badge",
        type: OptionType.BOOLEAN,
        default: true
    }
});
