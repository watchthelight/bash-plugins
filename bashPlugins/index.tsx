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
import { Alerts } from "@webpack/common";

import { Panel, updateAndRebuild } from "./panel";

const Native = VencordNative.pluginHelpers.BashPlugins as PluginNative<typeof import("./native")>;
const logger = new Logger("BashPlugins");

const SEEN_KEY = "BashPlugins_lastPromptedSha";
const POLL_MS = 90_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let prompting = false;

const settings = definePluginSettings({
    autoCheck: {
        type: OptionType.BOOLEAN,
        description: "Watch GitHub while Discord runs and ask as soon as Bash pushes an update (checked every 90 seconds, costs nothing when nothing changed)",
        default: true
    },
    autoUpdate: {
        type: OptionType.BOOLEAN,
        description: "Skip the question: pull and rebuild on your own, then ask to reload",
        default: false
    },
    panel: {
        type: OptionType.COMPONENT,
        component: Panel
    }
});

async function applyUpdate(message: string) {
    const prefix = await updateAndRebuild();
    showNotification({
        title: "Bash's plugins updated",
        body: `${prefix}"${message}" is built. Click to reload.`,
        onClick: () => location.reload()
    });
}

async function poll() {
    if (prompting) return;
    const status = await Native.getStatus();
    if (!status.installed) return;

    const remote = await Native.remoteHead();
    if (!remote || remote.sha === status.head) return;

    const seen = await DataStore.get<string>(SEEN_KEY);
    if (seen === remote.sha) return;
    await DataStore.set(SEEN_KEY, remote.sha);

    if (settings.store.autoUpdate) {
        await applyUpdate(remote.message);
        return;
    }

    prompting = true;
    Alerts.show({
        title: "Bash pushed an update",
        body: `${remote.message}\n\nMake it happen now or later?`,
        confirmText: "Now",
        cancelText: "Later",
        onConfirm: () => { prompting = false; applyUpdate(remote.message).catch(e => logger.error("update failed", e)); },
        onCancel: () => { prompting = false; },
        onCloseCallback: () => { prompting = false; }
    });
}

export default definePlugin({
    name: "BashPlugins",
    description: "Installs and updates all of Bash's plugins from GitHub without leaving Discord",
    authors: [{ name: "watchthelight", id: 697169405422862417n }],
    tags: ["Utility"],
    settings,

    start() {
        if (!settings.store.autoCheck) return;
        const run = () => poll().catch(e => logger.error("update check failed", e));
        setTimeout(run, 8_000);
        pollTimer = setInterval(run, POLL_MS);
    },

    stop() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    },

    // the panel's notification path reuses this
    openPanel() {
        openPluginModal(plugins.BashPlugins);
    }
});
