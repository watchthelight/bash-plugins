/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { findComponentByCodeLazy } from "@webpack";
import { showToast, Toasts } from "@webpack/common";

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
    const on = !settings.store.sortActive;
    settings.store.sortActive = on;
    const n = getGhostCount();
    showToast(
        on ? `Sorting by ghosted, ${n} ghosted DM${n === 1 ? "" : "s"}` : "Back to Discord's order",
        on && n === 0 ? Toasts.Type.FAILURE : Toasts.Type.SUCCESS
    );
}

export const SortRow = ErrorBoundary.wrap(function SortRow() {
    useGhostVersion();
    const { sortActive } = settings.use(["sortActive"]);
    const count = getGhostCount();

    return (
        // display:contents wrapper: no layout impact, but a capture-phase listener here sees every click
        // inside the row before Discord's Link does, whatever props LinkButton forwards or swallows
        <div
            className="vc-ghosted-sort-wrap"
            onClickCapture={(e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                toggle();
            }}
        >
            <LinkButton
                selected={sortActive}
                // Link needs a pathname; current one = no-op even if a click ever got through
                route={window.location.pathname}
                icon={RowIcon}
                text={sortActive ? "Sorted by ghosted" : "Sort by ghosted"}
                className={`vc-ghosted-sort-row ${sortActive ? "vc-ghosted-sort-active" : ""}`}
            >
                {count > 0 && <span className="vc-ghosted-sort-count">{count}</span>}
            </LinkButton>
        </div>
    );
}, { noop: true });
