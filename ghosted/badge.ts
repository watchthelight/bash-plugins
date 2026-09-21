/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 watchthelight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BadgePosition, ProfileBadge } from "@api/Badges";
import { openContributorModal } from "@components/settings/tabs";
import { isPluginDev } from "@utils/misc";
import { UserStore } from "@webpack/common";

export const AUTHOR_ID = "697169405422862417";

// same asset Vencord's BadgeAPI uses for its contributor badge
const CONTRIBUTOR_BADGE = "https://cdn.discordapp.com/emojis/1092089799109775453.png?size=64";

export const ContributorBadge: ProfileBadge = {
    id: "vencord_contributor_badge",
    description: "Vencord Contributor",
    iconSrc: CONTRIBUTOR_BADGE,
    position: BadgePosition.START,
    // skip when this build already lists the author in Devs (own fork) — BadgeAPI shows it there
    shouldShow: ({ userId }) => userId === AUTHOR_ID && !isPluginDev(userId),
    onClick: (_, { userId }) => openContributorModal(UserStore.getUser(userId))
};
