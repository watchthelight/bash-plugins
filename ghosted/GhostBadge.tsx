/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { moment, ReadStateStore, Tooltip, useStateFromStores } from "@webpack/common";

import { settings } from "./settings";
import { getGhost, useGhostVersion } from "./store";

function formatAge(ms: number) {
    const m = Math.floor(ms / 60e3);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

export const GhostBadge = ErrorBoundary.wrap(function GhostBadge({ channelId }: { channelId: string; }) {
    useGhostVersion();
    // re-render when the ack position moves (you read the DM)
    useStateFromStores([ReadStateStore], () => ReadStateStore.ackMessageId(channelId));

    const ghost = getGhost(channelId);
    if (!ghost) return null;

    const age = Date.now() - ghost.since;

    return (
        <Tooltip text={`Ghosted · they messaged ${moment(ghost.since).fromNow()}`}>
            {props => (
                <span {...props} className="vc-ghosted-badge">
                    {/* icon is a CSS mask so the animated gradient shows through it, same as the text */}
                    <span className="vc-ghosted-icon vc-ghosted-shine" aria-hidden="true" />
                    {settings.store.showAge && <span className="vc-ghosted-age vc-ghosted-shine">{formatAge(age)}</span>}
                </span>
            )}
        </Tooltip>
    );
}, { noop: true });
