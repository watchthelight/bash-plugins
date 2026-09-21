/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { HeadingTertiary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { relaunch } from "@utils/native";
import { useAwaiter, useForceUpdater } from "@utils/react";
import { PluginNative } from "@utils/types";
import { findStoreLazy } from "@webpack";
import { Alerts } from "@webpack/common";
import { patches } from "@webpack/patcher";

import { settings } from "./settings";

const Native = VencordNative.pluginHelpers.Turbo as PluginNative<typeof import("./native")>;
const AccessibilityStore = findStoreLazy("AccessibilityStore") as { useReducedMotion: boolean; };

// plugins that keep costing CPU after startup, with the reason shown to the user
const HEAVY: Record<string, string> = {
    MessageLogger: "Keeps every edited and deleted message in memory, for every channel, with no filters set",
    ShikiCodeblocks: "Runs a full TextMate syntax highlighter on every code block, and loads a theme from a CDN",
    ShowHiddenChannels: "Recomputes permissions for every channel in every server",
    WhoReacted: "Fetches the full reactor list for reactions on screen",
    ReviewDB: "Polls a third party API in the background",
    BetterSessions: "Polls your session list on an interval",
    PlatformIndicators: "Adds icons to every member row and every message",
    MoreUserTags: "Extra tag lookups on every message and member row",
    ImplicitRelationships: "Scans relationship and message data to build an implicit friend list",
    RelationshipNotifier: "Diffs your full relationship and server state continuously",
    TypingIndicator: "Processes every typing event with avatar rendering",
    TypingTweaks: "Processes every typing event with avatar rendering",
    AppleMusicRichPresence: "One of three rich presence plugins polling at once",
    MusicRichPresence: "One of three rich presence plugins polling at once",
    GameActivityToggle: "One of three rich presence plugins polling at once"
};

function askRestart(what: string) {
    Alerts.show({
        title: "Restart needed",
        body: `${what} takes effect after Discord restarts.`,
        confirmText: "Restart now",
        cancelText: "Later",
        onConfirm: relaunch
    });
}

function Row({ text, action, onAction }: { text: string; action?: string; onAction?: () => void; }) {
    return (
        <Flex style={{ alignItems: "center", justifyContent: "space-between", gap: "1em", padding: "6px 0" }}>
            <Paragraph style={{ margin: 0 }}>{text}</Paragraph>
            {action && onAction && <Button size="small" variant="secondary" onClick={onAction}>{action}</Button>}
        </Flex>
    );
}

export const Report = ErrorBoundary.wrap(function Report() {
    const forceUpdate = useForceUpdater();
    const { instantAnimations, disableBackdropBlur } = settings.use(["instantAnimations", "disableBackdropBlur"]);
    const [flags] = useAwaiter(() => Native.getAppliedFlags(), { fallbackValue: [] as string[] });
    const [themeFiles] = useAwaiter(async () => (await VencordNative.themes.getThemesList()).map(t => t.fileName), { fallbackValue: null });

    const enabledNames = Object.values(plugins).filter(p => Settings.plugins[p.name]?.enabled).map(p => p.name);
    const patchCounts = new Map<string, number>();
    for (const p of patches) patchCounts.set(p.plugin, (patchCounts.get(p.plugin) ?? 0) + 1);
    const topPatchers = [...patchCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

    const danglingThemes = themeFiles ? Settings.enabledThemes.filter(t => !themeFiles.includes(t)) : [];
    const heavyEnabled = enabledNames.filter(n => n in HEAVY);

    const disablePlugin = (name: string) => {
        Settings.plugins[name].enabled = false;
        forceUpdate();
        askRestart(`Disabling ${name}`);
    };

    return (
        <div className="vc-turbo-report">
            <HeadingTertiary>Right now</HeadingTertiary>
            <Row text={`Reduced Motion: ${AccessibilityStore.useReducedMotion ? "on" : "off"}`} />
            <Row text={`Animations: ${instantAnimations ? "instant" : "Discord default"}`} />
            <Row text={`Backdrop blur: ${disableBackdropBlur ? "removed" : "Discord default"}`} />
            <Row text={`Chromium flags active: ${flags.length ? flags.join("  ") : "none (restart after changing flags)"}`} />

            <HeadingTertiary style={{ marginTop: "1em" }}>Vencord settings that cost frames</HeadingTertiary>
            {Settings.enableReactDevtools && (
                <Row
                    text="React DevTools is enabled. Its hook runs on every React commit."
                    action="Turn off"
                    onAction={() => { Settings.enableReactDevtools = false; forceUpdate(); askRestart("Turning off React DevTools"); }}
                />
            )}
            {Settings.windowsMaterial !== "none" && (
                <Row
                    text={`Window material is "${Settings.windowsMaterial}". Windows blurs what's behind the whole window every frame.`}
                    action="Set to none"
                    onAction={() => { Settings.windowsMaterial = "none"; forceUpdate(); askRestart("Changing the window material"); }}
                />
            )}
            {Settings.transparent && <Row text="Window transparency is on. Disables the opaque compositing fast path." />}
            {danglingThemes.length > 0 && (
                <Row
                    text={`${danglingThemes.length} enabled theme(s) no longer exist on disk: ${danglingThemes.join(", ")}`}
                    action="Remove"
                    onAction={() => { Settings.enabledThemes = Settings.enabledThemes.filter(t => !danglingThemes.includes(t)); forceUpdate(); }}
                />
            )}
            {!Settings.enableReactDevtools && Settings.windowsMaterial === "none" && !Settings.transparent && danglingThemes.length === 0 && (
                <Row text="Nothing to fix here." />
            )}

            <HeadingTertiary style={{ marginTop: "1em" }}>Plugins</HeadingTertiary>
            <Row text={`${enabledNames.length} plugins enabled, ${patches.length} webpack patches applied in total.`} />
            {heavyEnabled.map(name => (
                <Row key={name} text={`${name}: ${HEAVY[name]}`} action="Disable" onAction={() => disablePlugin(name)} />
            ))}
            <Paragraph style={{ marginTop: "0.5em", opacity: 0.7 }}>
                Most patches: {topPatchers.map(([n, c]) => `${n} (${c})`).join(", ")}
            </Paragraph>

            <HeadingTertiary style={{ marginTop: "1em" }}>Outside Vencord</HeadingTertiary>
            <Paragraph>
                Discord's own settings.json (in %AppData%\discord) has debugLogging turned on for the stable client. Set it to false, or delete the line, while Discord is closed.
            </Paragraph>
            <Paragraph>
                Themes that @import remote CSS (system24 does) fetch and parse that file on every reload. Turbo already overrides their transitions.
            </Paragraph>
        </div>
    );
}, { noop: true });
