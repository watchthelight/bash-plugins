/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BadgePosition, ProfileBadge } from "@api/Badges";

export const AUTHOR_ID = "697169405422862417";

const GHOST_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#e8c872' fill-rule='evenodd'><path d='M4 10a8 8 0 0 1 16 0v11l-2.7-2-2.6 2-2.7-2-2.7 2-2.6-2L4 21zm3.7 1a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0zm6 0a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0z'/></svg>";

export const DeveloperBadge: ProfileBadge = {
    id: "ghosted_developer",
    description: "Ghosted Developer",
    iconSrc: `data:image/svg+xml,${encodeURIComponent(GHOST_SVG)}`,
    position: BadgePosition.START,
    link: "https://github.com/watchthelight/vencord-ghosted",
    shouldShow: ({ userId }) => userId === AUTHOR_ID
};
