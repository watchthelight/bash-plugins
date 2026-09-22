/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";

const VISITS_KEY = "ServerExitWizard_visits";
const LEFT_KEY = "ServerExitWizard_left";

export interface LeftServer {
    id: string;
    name: string;
    icon: string | null;
    vanity: string | null;
    leftAt: number;
}

/** guildId -> ms of the last time you opened a channel there (tracked from install onward) */
let visits: Record<string, number> = {};
let left: LeftServer[] = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function load() {
    visits = (await DataStore.get(VISITS_KEY)) ?? {};
    left = (await DataStore.get(LEFT_KEY)) ?? [];
}

function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        void DataStore.set(VISITS_KEY, visits);
        void DataStore.set(LEFT_KEY, left);
    }, 1000);
}

export function recordVisit(guildId: string) {
    visits[guildId] = Date.now();
    save();
}

export function lastVisit(guildId: string): number | undefined {
    return visits[guildId];
}

export function recordLeft(s: LeftServer) {
    left = [s, ...left.filter(l => l.id !== s.id)].slice(0, 200);
    delete visits[s.id];
    save();
}

export function getLeft() {
    return left;
}
