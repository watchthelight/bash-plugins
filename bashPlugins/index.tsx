/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { plugins } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { openPluginModal } from "@components/settings/tabs/plugins/PluginModal";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, PluginNative } from "@utils/types";

import { Panel, updateAndRebuild } from "./panel";

const Native = VencordNative.pluginHelpers.BashPlugins as PluginNative<typeof import("./native")>;
const logger = new Logger("BashPlugins");

const LAST_CHECK_KEY = "BashPlugins_lastCheck";
const CHECK_EVERY_MS = 6 * 3600e3;

const settings = definePluginSettings({
    autoCheck: {
        type: OptionType.BOOLEAN,
        description: "Check GitHub for plugin updates when Discord starts (at most every 6 hours)",
        default: true
    },
    autoUpdate: {
        type: OptionType.BOOLEAN,
        description: "Pull and rebuild automatically when updates are found, then ask to reload",
        default: false
    },
    panel: {
        type: OptionType.COMPONENT,
        component: Panel
    }
});

async function startupCheck() {
    const last = await DataStore.get<number>(LAST_CHECK_KEY) ?? 0;
    if (Date.now() - last < CHECK_EVERY_MS) return;
    await DataStore.set(LAST_CHECK_KEY, Date.now());

    const status = await Native.getStatus();
    if (!status.installed) return;

    const updates = await Native.checkUpdates();
    if (updates.length === 0) return;

    const n = updates.length;
    if (settings.store.autoUpdate) {
        const prefix = await updateAndRebuild();
        showNotification({
            title: "Bash's plugins updated",
            body: `${prefix}${n} new commit${n === 1 ? "" : "s"} built. Click to reload.`,
            onClick: () => location.reload()
        });
    } else {
        showNotification({
            title: "Bash's plugins",
            body: `${n} update${n === 1 ? "" : "s"} available. Click to see what changed.`,
            onClick: () => openPluginModal(plugins.BashPlugins)
        });
    }
}

export default definePlugin({
    name: "BashPlugins",
    description: "Installs and updates all of Bash's plugins from GitHub without leaving Discord",
    authors: [{ name: "watchthelight", id: 697169405422862417n }],
    tags: ["Utility"],
    settings,

    start() {
        if (settings.store.autoCheck) {
            startupCheck().catch(e => logger.error("update check failed", e));
        }
    }
});
