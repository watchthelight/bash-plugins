/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { findComponentByCodeLazy } from "@webpack";

import { settings } from "./settings";
import { getGhostCount, useGhostVersion } from "./store";

// Discord's DM-list nav row (Friends / Nitro / Shop / Quests all use it).
// Renders <li><Interactive selected><Link to={route} {...rest}><Avatar icon={icon} name={text}/></Link></Interactive></li>
const LinkButton = findComponentByCodeLazy("interactiveClassName:", "showHoverGradient:", "listItemRef:");

function RowIcon({ className }: { className?: string; }) {
    return <span className={`vc-ghosted-icon vc-ghosted-row-icon ${className ?? ""}`} aria-hidden="true" />;
}

let lastToggle = 0;
// both the capture handler on the <a> and onClick on the <li> may fire for one click; collapse them
function toggle() {
    const now = Date.now();
    if (now - lastToggle < 150) return;
    lastToggle = now;
    settings.store.sortActive = !settings.store.sortActive;
}

export const SortRow = ErrorBoundary.wrap(function SortRow() {
    useGhostVersion();
    const { sortActive } = settings.use(["sortActive"]);
    const count = getGhostCount();

    return (
        <LinkButton
            selected={sortActive}
            // Link needs a pathname; current one = no navigation. click is swallowed in capture below anyway
            route={window.location.pathname}
            icon={RowIcon}
            text={sortActive ? "Sorted by ghosted" : "Sort by ghosted"}
            className={`vc-ghosted-sort-row ${sortActive ? "vc-ghosted-sort-active" : ""}`}
            // onClick lands on the outer <li> — the prop Discord's own rows (Message Requests) use
            onClick={toggle}
            // if the Link forwards rest props to its <a>, this fires first and stops the (same-path) navigation
            onClickCapture={(e: React.MouseEvent) => {
                e.preventDefault();
                toggle();
            }}
        >
            {count > 0 && <span className="vc-ghosted-sort-count">{count}</span>}
        </LinkButton>
    );
}, { noop: true });
