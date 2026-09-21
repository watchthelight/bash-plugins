/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    thresholdHours: {
        description: "Hours since their last message before a read-but-unanswered DM counts as ghosted",
        type: OptionType.SLIDER,
        markers: [0, 1, 2, 4, 8, 12, 24, 48],
        default: 2,
        stickToMarkers: false
    },
    includeUnread: {
        description: "Also flag DMs you haven't read yet (Discord already badges these)",
        type: OptionType.BOOLEAN,
        default: false
    },
    ignoreBots: {
        description: "Never flag DMs where the last message is from a bot",
        type: OptionType.BOOLEAN,
        default: true
    },
    reactionCountsAsReply: {
        description: "Reacting to their message counts as a reply",
        type: OptionType.BOOLEAN,
        default: true
    },
    bootstrapCount: {
        description: "On startup, fetch the last message of this many recent DMs so ghosts from before install show up (0 = never fetch, track from now on only)",
        type: OptionType.SLIDER,
        markers: [0, 10, 20, 30, 50, 100],
        default: 30,
        stickToMarkers: false
    },
    showAge: {
        description: "Show how long they've been waiting next to the ghost icon",
        type: OptionType.BOOLEAN,
        default: true
    },
    sortButton: {
        description: "Show a 'Sort by ghosted' row in the DM list (under Quests) that reorders DMs, longest-ghosted first",
        type: OptionType.BOOLEAN,
        default: true
    },
    sortActive: {
        description: "Sort DMs by ghosted (toggled by the row above)",
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true
    }
});
