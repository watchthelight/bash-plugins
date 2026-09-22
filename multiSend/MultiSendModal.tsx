/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Paragraph } from "@components/Paragraph";
import { RenderModalProps, User } from "@vencord/discord-types";
import { ChannelStore, Modal, openModal, RelationshipStore, showToast, TextArea, TextInput, Toasts, useMemo, useRef, UserStore, useState } from "@webpack/common";

import { displayName, Progress, render, sendToMany } from "./send";
import { settings } from "./settings";

function candidates(): User[] {
    const seen = new Set<string>();
    const out: { user: User; recent: bigint; }[] = [];
    for (const c of ChannelStore.getSortedPrivateChannels()) {
        if (!c.isDM()) continue;
        const id = c.getRecipientId();
        const u = id && UserStore.getUser(id);
        if (!u || u.bot || seen.has(u.id)) continue;
        seen.add(u.id);
        out.push({ user: u, recent: c.lastMessageId ? BigInt(c.lastMessageId) : 0n });
    }
    for (const id of RelationshipStore.getFriendIDs()) {
        if (seen.has(id)) continue;
        const u = UserStore.getUser(id);
        if (!u || u.bot) continue;
        seen.add(id);
        out.push({ user: u, recent: 0n });
    }
    out.sort((a, b) => (a.recent === b.recent ? 0 : a.recent > b.recent ? -1 : 1));
    return out.map(o => o.user);
}

function MultiSendModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const all = useMemo(candidates, []);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [text, setText] = useState("");
    const [progress, setProgress] = useState<Progress | null>(null);
    const abort = useRef<AbortController | null>(null);
    const max = settings.store.maxRecipients;

    const shown = query
        ? all.filter(u => displayName(u).toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()))
        : all;
    const toggle = (id: string) => setSelected(s => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else if (n.size < max) n.add(id);
        return n;
    });
    const chosen = all.filter(u => selected.has(u.id));
    const preview = chosen[0] ? render(text, chosen[0]) : "";
    const running = !!progress && progress.done < progress.total && !!progress.current;

    const start = async () => {
        abort.current = new AbortController();
        const result = await sendToMany(
            chosen, text,
            { minDelay: settings.store.minDelay, maxDelay: settings.store.maxDelay, typeFirst: settings.store.typeFirst },
            setProgress, abort.current.signal
        );
        showToast(
            result.failed.length
                ? `Sent to ${result.done - result.failed.length}, failed for ${result.failed.join(", ")}`
                : `Sent to ${result.done} ${result.done === 1 ? "person" : "people"}`,
            result.failed.length ? Toasts.Type.FAILURE : Toasts.Type.SUCCESS
        );
    };

    return (
        <Modal {...modalProps} size="lg" title="Send to several people">
            <div className="vc-ms-body">
                <div className="vc-ms-left">
                    <TextArea
                        value={text}
                        onChange={setText}
                        rows={6}
                        placeholder={"good morning {first} ☀️\n---\nmorning {first}, hope today's a good one"}
                    />
                    <Paragraph className="vc-ms-hint">
                        {"{name}"} is their display name, {"{first}"} its first word, {"{username}"} their handle. A line with only <code>---</code> separates variants; each person gets a random one.
                    </Paragraph>
                    {preview && <Paragraph className="vc-ms-preview">Preview for {displayName(chosen[0])}: <em>{preview}</em></Paragraph>}
                    <Paragraph className="vc-ms-hint">
                        Messages go out one at a time with {settings.store.minDelay} to {settings.store.maxDelay} seconds between them{settings.store.typeFirst ? ", typing indicator first" : ""}. Change that in the plugin settings.
                    </Paragraph>
                </div>
                <div className="vc-ms-right">
                    <TextInput value={query} onChange={setQuery} placeholder="Search people" />
                    <Flex className="vc-ms-quick">
                        <Button size="small" variant="secondary" onClick={() => setSelected(new Set(all.slice(0, Math.min(10, max)).map(u => u.id)))}>Recent 10</Button>
                        <Button size="small" variant="secondary" onClick={() => setSelected(new Set())}>Clear</Button>
                        <span className="vc-ms-count">{selected.size} / {max}</span>
                    </Flex>
                    <div className="vc-ms-list">
                        {shown.map(u => (
                            <label key={u.id} className={`vc-ms-row ${selected.has(u.id) ? "vc-ms-on" : ""}`}>
                                <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                                <img src={u.getAvatarURL(undefined, 32)} alt="" />
                                <span className="vc-ms-name">{displayName(u)}</span>
                                <span className="vc-ms-handle">{u.username}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            <Flex className="vc-ms-footer">
                {progress && (
                    <span className="vc-ms-progress">
                        {progress.current ? `Sending to ${progress.current}` : "Done"} · {progress.done}/{progress.total}
                        {progress.failed.length ? ` · failed: ${progress.failed.length}` : ""}
                    </span>
                )}
                {running
                    ? <Button size="small" variant="dangerSecondary" onClick={() => abort.current?.abort()}>Stop</Button>
                    : <Button size="small" disabled={!text.trim() || chosen.length === 0} onClick={start}>Send to {chosen.length}</Button>}
            </Flex>
        </Modal>
    );
}

export function openMultiSendModal() {
    openModal(props => (
        <ErrorBoundary>
            <MultiSendModal modalProps={props} />
        </ErrorBoundary>
    ));
}
