/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { HeadingTertiary } from "@components/Heading";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { useAwaiter } from "@utils/react";
import { PluginNative } from "@utils/types";
import { Alerts, useState } from "@webpack/common";

import { PluginMeta } from "~plugins";

import type { UpdateEntry } from "./native";

const Native = VencordNative.pluginHelpers.BashPlugins as PluginNative<typeof import("./native")>;
const REPO_URL = "https://github.com/watchthelight/bash-plugins";

/** plugin display name for a folder inside src/userplugins, if this build contains it */
function pluginNameForDir(dir: string) {
    const folder = `src/userplugins/${dir}`;
    return Object.entries(PluginMeta).find(([, m]) => m.folderName === folder)?.[0];
}

export async function updateAndRebuild(): Promise<string> {
    await Native.pull();
    const links = await Native.syncLinks();
    const res = await VencordNative.updater.rebuild();
    if (!res.ok || !res.value) throw new Error("Vencord build failed, check the console");
    return links.created.length ? `New plugins linked: ${links.created.join(", ")}. ` : "";
}

function askReload(prefix = "") {
    Alerts.show({
        title: "Update installed",
        body: `${prefix}Reload Discord to start using the new build.`,
        confirmText: "Reload now",
        cancelText: "Later",
        onConfirm: () => location.reload()
    });
}

export const Panel = ErrorBoundary.wrap(function Panel() {
    const [nonce, setNonce] = useState(0);
    const [status] = useAwaiter(() => Native.getStatus(), { fallbackValue: null, deps: [nonce] });
    const [updates, setUpdates] = useState<UpdateEntry[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async (label: string, fn: () => Promise<void>) => {
        setBusy(label);
        setError(null);
        try {
            await fn();
        } catch (e: any) {
            setError(String(e?.message ?? e));
        } finally {
            setBusy(null);
            setNonce(n => n + 1);
        }
    };

    if (!status) return <Paragraph>Reading repo state...</Paragraph>;

    if (!status.installed) {
        return (
            <div>
                <Paragraph>The plugin repo isn't cloned yet. Expected at <code>{status.path}</code>.</Paragraph>
                <Button disabled={!!busy} onClick={() => run("install", async () => {
                    await Native.install();
                    await Native.syncLinks();
                    const res = await VencordNative.updater.rebuild();
                    if (!res.ok || !res.value) throw new Error("Vencord build failed, check the console");
                    askReload();
                })}>
                    {busy === "install" ? "Installing..." : "Clone, link and build"}
                </Button>
                {error && <Paragraph style={{ color: "var(--text-danger)" }}>{error}</Paragraph>}
            </div>
        );
    }

    return (
        <div>
            <HeadingTertiary>Plugins in this repo</HeadingTertiary>
            {status.plugins.map(p => {
                const name = pluginNameForDir(p.dir);
                const enabled = name ? !!Settings.plugins[name]?.enabled : false;
                const state = p.shadowed
                    ? "a separate folder with the same name is in the way"
                    : !p.linked
                        ? "not linked yet, press Sync"
                        : !name
                            ? "linked, rebuild to load it"
                            : enabled ? "enabled" : "installed, turned off";
                return (
                    <Flex key={p.dir} style={{ justifyContent: "space-between", padding: "4px 0" }}>
                        <span>{name ?? p.dir}</span>
                        <span style={{ opacity: 0.7 }}>{state}</span>
                    </Flex>
                );
            })}
            <Paragraph style={{ marginTop: "0.5em", opacity: 0.7 }}>
                Each one is a normal Vencord plugin. Turn them on or off in the plugin list like any other.
            </Paragraph>

            <HeadingTertiary style={{ marginTop: "1em" }}>Version</HeadingTertiary>
            <Paragraph>
                <code>{status.headShort}</code> {status.headSubject}
            </Paragraph>
            {updates && (
                updates.length === 0
                    ? <Paragraph>Up to date.</Paragraph>
                    : (
                        <div>
                            <Paragraph>{updates.length} new commit{updates.length === 1 ? "" : "s"}:</Paragraph>
                            <ul style={{ margin: "0 0 0.5em 1.2em" }}>
                                {updates.map(u => <li key={u.hash}><code>{u.hash}</code> {u.message}</li>)}
                            </ul>
                        </div>
                    )
            )}

            <Flex style={{ gap: "0.5em", flexWrap: "wrap" }}>
                <Button size="small" variant="secondary" disabled={!!busy} onClick={() => run("check", async () => {
                    setUpdates(await Native.checkUpdates());
                })}>
                    {busy === "check" ? "Checking..." : "Check for updates"}
                </Button>
                <Button size="small" disabled={!!busy || !updates?.length} onClick={() => run("update", async () => {
                    const prefix = await updateAndRebuild();
                    setUpdates([]);
                    askReload(prefix);
                })}>
                    {busy === "update" ? "Updating and building..." : "Update and rebuild"}
                </Button>
                <Button size="small" variant="secondary" disabled={!!busy} onClick={() => run("sync", async () => {
                    const r = await Native.syncLinks();
                    if (r.created.length) {
                        const res = await VencordNative.updater.rebuild();
                        if (!res.ok || !res.value) throw new Error("Vencord build failed, check the console");
                        askReload(`Linked ${r.created.join(", ")}. `);
                    }
                })}>
                    {busy === "sync" ? "Syncing..." : "Sync plugins"}
                </Button>
                <Link href={REPO_URL}>Open on GitHub</Link>
            </Flex>
            {error && <Paragraph style={{ color: "var(--text-danger)", marginTop: "0.5em" }}>{error}</Paragraph>}
        </div>
    );
}, { noop: true });
