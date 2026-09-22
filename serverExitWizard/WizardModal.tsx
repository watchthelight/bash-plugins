/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Paragraph } from "@components/Paragraph";
import { Guild, RenderModalProps } from "@vencord/discord-types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Alerts, GuildStore, IconUtils, Modal, moment, openModal, showToast, TextInput, Toasts, useMemo, UserStore, useState } from "@webpack/common";

import { settings } from "./settings";
import { getLeft, lastVisit, recordLeft } from "./store";

const GuildActions = findByPropsLazy("leaveGuild") as { leaveGuild(guildId: string): Promise<void>; };
const GuildMemberCountStore = findStoreLazy("GuildMemberCountStore") as { getMemberCount(guildId: string): number | null; };
const GuildReadStateStore = findStoreLazy("GuildReadStateStore") as { hasUnread(guildId: string): boolean; getMentionCount(guildId: string): number; };

interface Row {
    guild: Guild;
    owner: boolean;
    members: number | null;
    joined: number;
    visited: number | undefined;
    unread: boolean;
    mentions: number;
}

function rows(): Row[] {
    const me = UserStore.getCurrentUser()?.id;
    return Object.values(GuildStore.getGuilds()).map(g => ({
        guild: g,
        owner: g.ownerId === me,
        members: GuildMemberCountStore.getMemberCount(g.id),
        joined: g.joinedAt ? new Date(g.joinedAt).getTime() : 0,
        visited: lastVisit(g.id),
        unread: GuildReadStateStore.hasUnread(g.id),
        mentions: GuildReadStateStore.getMentionCount(g.id)
    })).sort((a, b) => (a.visited ?? 0) - (b.visited ?? 0) || a.joined - b.joined);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function WizardModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const [nonce, setNonce] = useState(0);
    const all = useMemo(rows, [nonce]);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<string | null>(null);
    const [tab, setTab] = useState<"servers" | "left">("servers");
    const cutoff = Date.now() - settings.store.staleDays * 86400e3;

    const shown = all.filter(r => !query || r.guild.name.toLowerCase().includes(query.toLowerCase()));
    const stale = all.filter(r => !r.owner && (r.visited ?? 0) < cutoff);
    const chosen = all.filter(r => selected.has(r.guild.id));

    const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const leave = () => Alerts.show({
        title: `Leave ${chosen.length} server${chosen.length === 1 ? "" : "s"}?`,
        body: chosen.map(r => r.guild.name).join(", "),
        confirmText: "Leave them",
        cancelText: "Keep",
        onConfirm: async () => {
            let n = 0;
            for (const r of chosen) {
                setBusy(r.guild.name);
                try {
                    await GuildActions.leaveGuild(r.guild.id);
                    recordLeft({ id: r.guild.id, name: r.guild.name, icon: r.guild.icon ?? null, vanity: r.guild.vanityURLCode ?? null, leftAt: Date.now() });
                    n++;
                } catch { /* keep going */ }
                await sleep(1500);
            }
            setBusy(null);
            setSelected(new Set());
            setNonce(x => x + 1);
            showToast(`Left ${n} server${n === 1 ? "" : "s"}`, Toasts.Type.SUCCESS);
        }
    });

    const when = (ts: number | undefined) => ts ? moment(ts).fromNow() : "not since install";

    return (
        <Modal {...modalProps} size="lg" title="Server exit wizard">
            <Flex className="vc-sew-tabs">
                <Button size="small" variant={tab === "servers" ? "primary" : "secondary"} onClick={() => setTab("servers")}>Servers ({all.length})</Button>
                <Button size="small" variant={tab === "left" ? "primary" : "secondary"} onClick={() => setTab("left")}>Left ({getLeft().length})</Button>
            </Flex>

            {tab === "servers" ? (
                <>
                    <Flex className="vc-sew-toolbar">
                        <TextInput value={query} onChange={setQuery} placeholder="Search servers" />
                        <Button size="small" variant="secondary" onClick={() => setSelected(new Set(stale.map(r => r.guild.id)))}>
                            Select untouched {settings.store.staleDays}d+ ({stale.length})
                        </Button>
                        <Button size="small" variant="secondary" onClick={() => setSelected(new Set())}>Clear</Button>
                    </Flex>
                    <Paragraph className="vc-sew-hint">
                        "Visited" counts from when this plugin was installed; Discord doesn't keep that history. Servers you own can't be selected.
                    </Paragraph>
                    <div className="vc-sew-list">
                        {shown.map(r => (
                            <label key={r.guild.id} className={`vc-sew-row ${selected.has(r.guild.id) ? "vc-sew-on" : ""} ${r.owner ? "vc-sew-owner" : ""}`}>
                                <input type="checkbox" disabled={r.owner} checked={selected.has(r.guild.id)} onChange={() => toggle(r.guild.id)} />
                                {r.guild.icon
                                    ? <img src={IconUtils.getGuildIconURL({ id: r.guild.id, icon: r.guild.icon, size: 32, canAnimate: false })} alt="" />
                                    : <span className="vc-sew-noicon">{r.guild.name.split(/\s+/).map(w => w[0]).join("").slice(0, 3)}</span>}
                                <span className="vc-sew-name">{r.guild.name}{r.owner ? " (yours)" : ""}</span>
                                <span className="vc-sew-meta">
                                    {r.members != null ? `${r.members.toLocaleString()} members · ` : ""}
                                    joined {moment(r.joined).fromNow()} · visited {when(r.visited)}
                                    {r.mentions ? ` · ${r.mentions} mention${r.mentions === 1 ? "" : "s"}` : r.unread ? " · unread" : ""}
                                </span>
                            </label>
                        ))}
                    </div>
                    <Flex className="vc-sew-footer">
                        {busy && <span className="vc-sew-progress">Leaving {busy}...</span>}
                        <Button size="small" variant="dangerPrimary" disabled={!!busy || chosen.length === 0} onClick={leave}>
                            Leave {chosen.length} selected
                        </Button>
                    </Flex>
                </>
            ) : (
                <div className="vc-sew-list">
                    {getLeft().length === 0 && <Paragraph className="vc-sew-hint">Nothing left through the wizard yet.</Paragraph>}
                    {getLeft().map(l => (
                        <div key={l.id} className="vc-sew-row">
                            <span className="vc-sew-name">{l.name}</span>
                            <span className="vc-sew-meta">
                                left {moment(l.leftAt).fromNow()}
                                {l.vanity ? <> · <a href={`https://discord.gg/${l.vanity}`} target="_blank" rel="noreferrer">discord.gg/{l.vanity}</a></> : " · no public invite known"}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}

export function openWizard() {
    openModal(props => (
        <ErrorBoundary>
            <WizardModal modalProps={props} />
        </ErrorBoundary>
    ));
}
