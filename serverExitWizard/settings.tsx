/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { OptionType } from "@utils/types";

import { openWizard } from "./WizardModal";

export const settings = definePluginSettings({
    open: {
        type: OptionType.COMPONENT,
        component: () => <Button onClick={openWizard}>Open the wizard</Button>
    },
    staleDays: {
        description: "A server counts as untouched when you haven't opened it for this many days",
        type: OptionType.SLIDER,
        markers: [7, 14, 30, 60, 90, 180, 365],
        default: 60,
        stickToMarkers: false
    }
});
