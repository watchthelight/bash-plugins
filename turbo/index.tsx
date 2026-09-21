/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import { getUserSettingLazy } from "@api/UserSettings";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { findByCodeLazy, findStoreLazy } from "@webpack";

import { instantStyle, noBlurStyle, settings } from "./settings";

const logger = new Logger("Turbo");

const AccessibilityStore = findStoreLazy("AccessibilityStore") as { useReducedMotion: boolean; };
// Discord's own action behind the Accessibility > Reduced Motion checkbox. Besides flipping the
// preference it overrides gifAutoPlay / animateEmoji / animateStickers to "on interaction".
const setPrefersReducedMotion = findByCodeLazy("\"ACCESSIBILITY_SET_PREFERS_REDUCED_MOTION\"", "applySettingsOverride") as (v: "reduce" | "no-preference") => void;

const gifAutoPlay = getUserSettingLazy<boolean>("accessibility", "gifAutoPlay")!;
const animateEmoji = getUserSettingLazy<boolean>("accessibility", "animateEmoji")!;
const animateStickers = getUserSettingLazy<number>("accessibility", "animateStickers")!;
const STICKERS_ON_INTERACTION = 1;

export default definePlugin({
    name: "Turbo",
    description: "Makes Discord feel instant: animations finish immediately, media stays still until you hover, GPU flags, and a report of what else is slowing your client down",
    authors: [{ name: "watchthelight", id: 697169405422862417n }],
    tags: ["Appearance", "Utility"],
    dependencies: ["UserSettingsAPI"],
    settings,

    patches: [
        // Discord wraps react-spring's useSpring / useTransition / <Spring> and only forces
        // `immediate` when Reduced Motion is on AND the caller didn't ask for "animate-always"
        // (modals do). Short-circuit that decision.
        {
            find: "\"respect-motion-settings\"",
            all: true,
            replacement: [
                {
                    // useSpring + useTransition wrappers
                    match: /"animate-always"!==(\i)&&\("respect-motion-settings"!==\1\|\|(\i)\)/,
                    replace: "($self.instant()||$&)",
                    noWarn: true
                },
                {
                    // <Spring> component wrapper
                    match: /immediate:!\("animate-always"===(\i)\|\|"respect-motion-settings"===\1&&!(\i)\)/,
                    replace: "immediate:$self.instant()||!(\"animate-always\"===$1||\"respect-motion-settings\"===$1&&!$2)",
                    noWarn: true
                }
            ]
        }
    ],

    instant() {
        return settings.store.instantAnimations;
    },

    start() {
        if (settings.store.instantAnimations) enableStyle(instantStyle);
        if (settings.store.disableBackdropBlur) enableStyle(noBlurStyle);

        try {
            if (settings.store.forceReducedMotion && !AccessibilityStore.useReducedMotion) {
                setPrefersReducedMotion("reduce");
            }
        } catch (e) {
            logger.error("failed to enable Reduced Motion", e);
        }

        if (settings.store.mediaMode === "hover") {
            // Discord only applies its own overrides at toggle time, so set the real settings too.
            void Promise.all([
                gifAutoPlay.getSetting() !== false && gifAutoPlay.updateSetting(false),
                animateEmoji.getSetting() !== false && animateEmoji.updateSetting(false),
                animateStickers.getSetting() !== STICKERS_ON_INTERACTION && animateStickers.updateSetting(STICKERS_ON_INTERACTION)
            ]).catch(e => logger.error("failed to update media settings", e));
        }
    },

    stop() {
        disableStyle(instantStyle);
        disableStyle(noBlurStyle);
    }
});
