/**
 * Badge info module things
 * @module twitch/badge
 * @author Martin Giger
 * @license MPL-2.0
 */
"use strict";

const BADGE_CHANNEL_SPLITTER = ":";

const BADGES = [ "staff", "admin", "global_mod", "mod", "sub", "turbo", "premium", "bot", "bits", "clip-champ", "sub-gifter", "bits-leader", "verified" ];
const HAS_CHANNEL = [ "mod", "sub", "bits", "bits-leader", "clip-champ", "sub-gifter" ];
const DECORATIVE = [ "turbo", "bot", "bits", "bits-leader", "clip-champ", "sub-gifter", "premium", "verified" ];
const ALIASES = {
    subscriber: 'sub',
    moderator: 'mod'
};

exports.isChannelSpecific = (badge) => {
    return badge.includes(BADGE_CHANNEL_SPLITTER);
};

exports.getBadge = (badge, channel) => {
    const hasChannelSplitter = exports.isChannelSpecific(badge);

    if(ALIASES.hasOwnProperty(badge)) {
        badge = ALIASES[badge];
    }
    if(HAS_CHANNEL.includes(badge) && !hasChannelSplitter) {
        return badge + BADGE_CHANNEL_SPLITTER + channel;
    }
    else if(BADGES.includes(badge) || hasChannelSplitter) {
        return badge;
    }
};

exports.getBadgeName = (badge) => {
    if(exports.isChannelSpecific(badge)) {
        return badge.split(BADGE_CHANNEL_SPLITTER)[0];
    }
    else {
        return badge;
    }
};

exports.getChannelFromBadge = (badge) => {
    if(exports.isChannelSpecific(badge)) {
        return badge.split(BADGE_CHANNEL_SPLITTER)[1];
    }
    else {
        throw "Badge isn't channel specific";
    }
};

exports.HAS_CHANNEL = HAS_CHANNEL;
exports.BADGES = BADGES;
exports.DECORATIVE_BADGES = DECORATIVE;
