/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { moment, Tooltip } from "@webpack/common";

import { useGhostVersion } from "../ghosted/store";
import { settings } from "./settings";
import { getRadar, useRadarVersion } from "./store";

function ago(ts: number) {
    return moment(ts).fromNow();
}

function short(ms: number) {
    const m = Math.floor(ms / 60e3);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

export const RadarBadge = ErrorBoundary.wrap(function RadarBadge({ channelId }: { channelId: string; }) {
    useGhostVersion();
    useRadarVersion();
    const r = getRadar(channelId);
    if (!r) return null;

    const lines = [`Waiting on a reply, you sent ${ago(r.sentAt)}`];
    if (settings.store.showTyping && r.typed.length)
        lines.push(`They started typing ${r.typed.length > 1 ? `${r.typed.length} times, last ` : ""}${ago(r.typed[r.typed.length - 1])} and never sent`);
    if (settings.store.showPresence && r.online.length)
        lines.push(`Online ${r.online.length} time${r.online.length === 1 ? "" : "s"} since, last ${ago(r.online[r.online.length - 1])}`);

    const typed = r.typed.length > 0;
    return (
        <Tooltip text={lines.join(". ")}>
            {props => (
                <span {...props} className={`vc-lor-badge ${typed ? "vc-lor-typed" : ""}`}>
                    <span className="vc-lor-icon" aria-hidden="true" />
                    <span className="vc-lor-age">{short(Date.now() - r.sentAt)}</span>
                </span>
            )}
        </Tooltip>
    );
}, { noop: true });
