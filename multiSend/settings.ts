/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    minDelay: {
        description: "Shortest pause between two messages, in seconds",
        type: OptionType.SLIDER,
        markers: [1, 2, 3, 5, 8, 12, 20],
        default: 3,
        stickToMarkers: false
    },
    maxDelay: {
        description: "Longest pause between two messages, in seconds",
        type: OptionType.SLIDER,
        markers: [3, 5, 8, 12, 20, 30, 60],
        default: 9,
        stickToMarkers: false
    },
    typeFirst: {
        description: "Show the typing indicator for a moment before each message, scaled to its length",
        type: OptionType.BOOLEAN,
        default: true
    },
    maxRecipients: {
        description: "Most people one send can go to",
        type: OptionType.SLIDER,
        markers: [5, 10, 15, 20, 30, 50],
        default: 20,
        stickToMarkers: false
    }
});
