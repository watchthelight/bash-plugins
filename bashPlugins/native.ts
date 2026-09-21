/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFile as cpExecFile } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import { existsSync, lstatSync, readdirSync, rmSync, symlinkSync } from "fs";
import { join } from "path";
import { promisify } from "util";

const execFile = promisify(cpExecFile);

const REPO_URL = "https://github.com/watchthelight/bash-plugins";

// __dirname is <vencord>/dist at runtime (same trick Vencord's own git updater uses)
const VENCORD_DIR = join(__dirname, "..");
const USERPLUGINS_DIR = join(VENCORD_DIR, "src", "userplugins");
// leading dot: Vencord's plugin scanner skips it, so the checkout itself is never treated as a plugin
const REPO_DIR = join(USERPLUGINS_DIR, ".bash-plugins");

export interface PluginEntry {
    /** folder name inside the repo, e.g. "ghosted" */
    dir: string;
    /** src/userplugins/<dir> exists and points into the repo */
    linked: boolean;
    /** src/userplugins/<dir> exists but is a real folder (old standalone clone) */
    shadowed: boolean;
}

export interface RepoStatus {
    installed: boolean;
    path: string;
    head: string;
    headShort: string;
    headSubject: string;
    plugins: PluginEntry[];
}

export interface UpdateEntry {
    hash: string;
    message: string;
}

function git(args: string[]) {
    return execFile("git", args, { cwd: REPO_DIR });
}

function isPluginDir(name: string) {
    if (name.startsWith(".") || name.startsWith("_")) return false;
    const dir = join(REPO_DIR, name);
    return existsSync(join(dir, "index.ts")) || existsSync(join(dir, "index.tsx"));
}

function listRepoPlugins(): PluginEntry[] {
    if (!existsSync(REPO_DIR)) return [];
    return readdirSync(REPO_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory() && isPluginDir(d.name))
        .map(d => {
            const link = join(USERPLUGINS_DIR, d.name);
            let linked = false, shadowed = false;
            if (existsSync(link)) {
                const st = lstatSync(link);
                linked = st.isSymbolicLink();
                shadowed = !linked && st.isDirectory();
            }
            return { dir: d.name, linked, shadowed };
        });
}

export async function getStatus(_: IpcMainInvokeEvent): Promise<RepoStatus> {
    const installed = existsSync(join(REPO_DIR, ".git"));
    let head = "", headShort = "", headSubject = "";
    if (installed) {
        const res = await git(["log", "-1", "--format=%H%n%h%n%s"]);
        [head, headShort, headSubject] = res.stdout.trim().split("\n");
    }
    return { installed, path: REPO_DIR, head, headShort, headSubject, plugins: listRepoPlugins() };
}

/** git fetch, then the commits we're behind by (newest first) */
export async function checkUpdates(_: IpcMainInvokeEvent): Promise<UpdateEntry[]> {
    await git(["fetch", "--quiet"]);
    const res = await git(["log", "--format=%h/%s", "HEAD..@{upstream}"]);
    return res.stdout.trim().split("\n").filter(Boolean).map(line => {
        const [hash, ...rest] = line.split("/");
        return { hash, message: rest.join("/") };
    });
}

export async function pull(_: IpcMainInvokeEvent): Promise<boolean> {
    const res = await git(["pull", "--ff-only", "--quiet"]);
    return !res.stderr.includes("fatal");
}

/** clone the repo if it isn't there yet */
export async function install(_: IpcMainInvokeEvent): Promise<void> {
    if (existsSync(join(REPO_DIR, ".git"))) return;
    await execFile("git", ["clone", "--quiet", REPO_URL, REPO_DIR], { cwd: USERPLUGINS_DIR });
}

/**
 * Expose every plugin folder in the repo as src/userplugins/<name> via a junction
 * (no admin rights needed on Windows). Removes junctions whose target vanished.
 * Never touches real folders; those are reported as "shadowed" instead.
 */
export async function syncLinks(_: IpcMainInvokeEvent): Promise<{ created: string[]; removed: string[]; shadowed: string[]; }> {
    const created: string[] = [], removed: string[] = [], shadowed: string[] = [];
    const type = process.platform === "win32" ? "junction" : "dir";

    for (const entry of readdirSync(USERPLUGINS_DIR, { withFileTypes: true })) {
        const link = join(USERPLUGINS_DIR, entry.name);
        if (!lstatSync(link).isSymbolicLink()) continue;
        if (!existsSync(link)) {
            rmSync(link);
            removed.push(entry.name);
        }
    }

    for (const p of listRepoPlugins()) {
        if (p.shadowed) { shadowed.push(p.dir); continue; }
        if (p.linked) continue;
        symlinkSync(join(REPO_DIR, p.dir), join(USERPLUGINS_DIR, p.dir), type);
        created.push(p.dir);
    }
    return { created, removed, shadowed };
}
