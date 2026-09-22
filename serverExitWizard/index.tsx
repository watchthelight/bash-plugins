/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ApplicationCommandInputType } from "@api/Commands";
import definePlugin from "@utils/types";

import { settings } from "./settings";
import * as Store from "./store";
import { openWizard } from "./WizardModal";

export default definePlugin({
    name: "ServerExitWizard",
    description: "Lists your servers by how long since you last opened them and lets you leave the dead ones in one go, keeping a list of what you left",
    authors: [{ name: "watchthelight", id: 697169405422862417n }],
    tags: ["Organisation"],
    dependencies: ["CommandsAPI"],
    settings,

    commands: [{
        name: "serverexit",
        description: "Open the server exit wizard",
        inputType: ApplicationCommandInputType.BUILT_IN,
        execute: () => { openWizard(); }
    }],

    flux: {
        CHANNEL_SELECT({ guildId }: { guildId?: string | null; }) {
            if (guildId) Store.recordVisit(guildId);
        }
    },

    async start() {
        await Store.load();
    }
});
