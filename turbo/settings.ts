/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { OptionType } from "@utils/types";

import { Report } from "./report";
import instantStyle from "./styles/instant.css?managed";
import noBlurStyle from "./styles/noblur.css?managed";

export const FLAG_SETTINGS = {
    flagRendererBackgrounding: {
        switches: [["disable-renderer-backgrounding"]],
        default: true,
        description: "Keep the renderer at full speed when another window has focus (disable-renderer-backgrounding)"
    },
    flagTimerThrottling: {
        switches: [["disable-background-timer-throttling"]],
        default: true,
        description: "Timers keep their normal rate in the background (disable-background-timer-throttling)"
    },
    flagWinOcclusion: {
        switches: [["disable-features", "CalculateNativeWinOcclusion"]],
        default: true,
        description: "Windows: stop the occlusion check that makes Discord stutter when other windows overlap it"
    },
    flagGpuRasterization: {
        switches: [["enable-gpu-rasterization"], ["enable-zero-copy"]],
        default: true,
        description: "GPU rasterization and zero-copy uploads (usually already on, harmless)"
    },
    flagIgnoreGpuBlocklist: {
        switches: [["ignore-gpu-blocklist"]],
        default: false,
        description: "Force the GPU path even if Chromium blocklisted your driver. Can cause glitches"
    },
    flagHighPerfGpu: {
        switches: [["force_high_performance_gpu"]],
        default: false,
        description: "Laptops with two GPUs: use the fast one"
    },
    flagNoFrameLimit: {
        switches: [["disable-frame-rate-limit"]],
        default: false,
        description: "Uncap the compositor frame rate. Burns GPU for little gain"
    }
} as const;

export type FlagKey = keyof typeof FLAG_SETTINGS;

const flagDefs = Object.fromEntries(
    Object.entries(FLAG_SETTINGS).map(([key, def]) => [key, {
        type: OptionType.BOOLEAN,
        description: def.description,
        default: def.default,
        restartNeeded: true
    }])
) as Record<FlagKey, { type: OptionType.BOOLEAN; description: string; default: boolean; restartNeeded: true; }>;

export const settings = definePluginSettings({
    instantAnimations: {
        type: OptionType.BOOLEAN,
        description: "Every animation finishes instantly: popouts, modals, menus, folders, hover effects",
        default: true,
        onChange: (v: boolean) => v ? enableStyle(instantStyle) : disableStyle(instantStyle)
    },
    forceReducedMotion: {
        type: OptionType.BOOLEAN,
        description: "Turn on Discord's own Reduced Motion setting on startup",
        default: true
    },
    mediaMode: {
        type: OptionType.SELECT,
        description: "Animated media (GIFs, emoji, stickers, avatars)",
        options: [
            { label: "Static until you hover", value: "hover", default: true },
            { label: "Leave Discord's media settings alone", value: "leave" }
        ]
    },
    disableBackdropBlur: {
        type: OptionType.BOOLEAN,
        description: "Remove backdrop blur behind layers and modals (expensive on weaker GPUs)",
        default: true,
        onChange: (v: boolean) => v ? enableStyle(noBlurStyle) : disableStyle(noBlurStyle)
    },
    ...flagDefs,
    report: {
        type: OptionType.COMPONENT,
        component: Report
    }
});

export { instantStyle, noBlurStyle };
