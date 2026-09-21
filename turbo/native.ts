/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Runs at main-process load, before Electron's `ready` (Vencord requires plugin natives from
// dist/patcher.js top level), so command line switches still take effect.

import { RendererSettings } from "@main/settings";
import { app } from "electron";

// keep in sync with FLAG_SETTINGS in settings.ts (natives can't import renderer code)
const FLAGS: Record<string, { switches: [string, string?][]; default: boolean; }> = {
    flagWinOcclusion: { switches: [["disable-features", "CalculateNativeWinOcclusion"]], default: true },
    flagGpuRasterization: { switches: [["enable-gpu-rasterization"], ["enable-zero-copy"]], default: true },
    flagIgnoreGpuBlocklist: { switches: [["ignore-gpu-blocklist"]], default: false },
    flagHighPerfGpu: { switches: [["force_high_performance_gpu"]], default: false },
    flagNoFrameLimit: { switches: [["disable-frame-rate-limit"]], default: false }
};

const FEATURE_SWITCHES = new Set(["enable-features", "disable-features"]);

const applied: string[] = [];
const pendingFeatures: Record<string, Set<string>> = { "enable-features": new Set(), "disable-features": new Set() };

function addFeature(kind: string, feature: string) {
    pendingFeatures[kind].add(feature);
    const current = app.commandLine.getSwitchValue(kind);
    const merged = new Set(current ? current.split(",") : []);
    merged.add(feature);
    originalAppend.call(app.commandLine, kind, [...merged].join(","));
}

// Discord's own main runs after the patcher and may set enable-/disable-features itself,
// which would replace ours. Merge into any later call (same trick Vencord used to ship).
const originalAppend = app.commandLine.appendSwitch;
app.commandLine.appendSwitch = function (this: typeof app.commandLine, key: string, value?: string) {
    if (FEATURE_SWITCHES.has(key) && pendingFeatures[key].size) {
        const merged = new Set(value ? value.split(",") : []);
        for (const f of pendingFeatures[key]) merged.add(f);
        value = [...merged].join(",");
    }
    return originalAppend.call(this, key, value as string);
} as typeof app.commandLine.appendSwitch;

try {
    const store = RendererSettings.store.plugins?.Turbo as Record<string, any> | undefined;
    if (store?.enabled) {
        for (const [key, def] of Object.entries(FLAGS)) {
            if (!(store[key] ?? def.default)) continue;
            for (const [name, value] of def.switches) {
                if (FEATURE_SWITCHES.has(name) && value) {
                    addFeature(name, value);
                    applied.push(`--${name}=${value}`);
                } else {
                    originalAppend.call(app.commandLine, name);
                    applied.push(`--${name}`);
                }
            }
        }
    }
} catch (e) {
    console.error("[Turbo] failed to apply Chromium switches", e);
}

export function getAppliedFlags() {
    return applied;
}
