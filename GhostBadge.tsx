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

function GhostIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
            <path d="M4 10a8 8 0 0 1 16 0v11l-2.7-2-2.6 2-2.7-2-2.7 2-2.6-2L4 21zm3.7 1a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0zm6 0a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0z" />
        </svg>
    );
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
                    <GhostIcon />
                    {settings.store.showAge && <span className="vc-ghosted-age">{formatAge(age)}</span>}
                </span>
            )}
        </Tooltip>
    );
}, { noop: true });
