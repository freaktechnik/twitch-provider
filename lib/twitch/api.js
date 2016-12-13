/*
 * Twitch REST API stuff
 */

const { prefs } = require("sdk/simple-prefs");
const { Request } = require("sdk/request");

const { getBadgeName, getChannelFromBadge, isChannelSpecific } = require("./badge");

const NO_BADGE = "";
const baseURL = "https://api.twitch.tv/kraken/";
const DEFAULT_EMOTE_SET = 0;

const headers = {
    Accept: "application/vnd.twitchtv.v3+json",
    "Client-ID": prefs.id
};

const fetch = (url, heads = headers) => {
    return new Promise((resolve, reject) => {
        Request({
            url,
            headers: heads,
            onComplete(data) {
                if(data.json) {
                    resolve(data);
                }
                else {
                    reject(data);
                }
            }
        }).get();
    });
};

const badges = new Map();
const images = new Map();

module.exports = {
    getViewers(channel) {
        return fetch(baseURL + "streams/" + channel).then((data) => {
            if("stream" in data.json && data.json.stream !== null) {
                return data.json.stream.viewers;
            }
            else {
                return 0;
            }
        });
    },
    getTitle(channel) {
        return fetch(baseURL + "channels/" + channel).then((data) => {
            if(data.status !== 404) {
                return data.json.status;
            }
            else {
                throw data;
            }
        });
    },
    // needs the channel_editor scope
    setTitle(channel, user, title) {
        return this.canSetTitle(channel, user).then((can) => {
            if(can) {
                return new Promise((resolve, reject) => {
                    Request({
                        url: baseURL + "channels/" + channel,
                        headers,
                        content: { channel: { status: title } },
                        onComplete(data) {
                            if(data.status == 200) {
                                resolve(title);
                            }
                            else {
                                reject(data);
                            }
                        }
                    }).put();
                });
            }
            else {
                throw "Can't set title";
            }
        });
    },
    setOAuth(token) {
        headers.Authorization = "OAuth " + token;
    },
    canSetTitle(channel, user) {
        return new Promise((resolve, reject) => {
            if("Authorization" in headers) {
                resolve(channel === user);
                // There is currently no way to check a user's editing rights on other channels.
            }
            else {
                reject("Not authorized");
            }
        });
    },
    getUserImage(user) {
        user = user.toLowerCase();
        if(images.has(user)) {
            return Promise.resolve(images.get(user));
        }

        return fetch(baseURL + "users/" + user).then((data) => {
            images.set(user, data.json.logo);
            return data.json.logo;
        });
    },
    getBadgesForChannel(channel) {
        if(badges.has(channel)) {
            return Promise.resolve(badges.get(channel));
        }
        else {
            return fetch(baseURL + "chat/" + channel + "/badges").then((data) => {
                if(data.status <= 399) {
                    badges.set(channel, data.json);
                    return data.json;
                }
                else {
                    throw data.json || data.text;
                }
            });
        }
    },
    getBadge(user, badgeType, channel) {
        const badgeName = getBadgeName(badgeType);
        if(isChannelSpecific(badgeType) && getChannelFromBadge(badgeType) !== channel) {
            return Promise.resolve(NO_BADGE);
        }

        return this.getBadgesForChannel(channel).then((badges) => {
            if(badgeName in badges && badges[badgeType]) {
                return badges[badgeName].image;
            }
            else {
                return NO_BADGE;
            }
        });
    },
    getBadgesForUser(user, badges, channel) {
        if(user == channel.slice(1)) {
            badges = badges.concat([ "broadcaster" ]);
        }

        return this.getBadgesForChannel(channel).then(
            Promise.all(badges.map((b) => this.getBadge(user, b, channel)))
            .then((actualBadges) => {
                return actualBadges.filter((aB) => aB !== NO_BADGE);
            })
        );
    },
    getEmoteSets(sets) {
        return fetch(baseURL + "chat/emoticon_images?emotesets=" + sets).then((data) => {
            let emoticons = [];
            for(const set in data.json.emoticon_sets) {
                if(parseInt(set, 10) == DEFAULT_EMOTE_SET) {
                    continue;
                }
                emoticons = emoticons.concat(data.json.emoticon_sets[set]);
            }
            const emoteSetRegExp = new RegExp("(^|,)" + DEFAULT_EMOTE_SET + "(,|$)");
            if(emoteSetRegExp.test(sets)) {
                emoticons = emoticons.concat(data.json.emoticon_sets[DEFAULT_EMOTE_SET]);
            }

            return emoticons;
        });
    },
    getChatters(channel) {
        //TODO does TMI need client_id?
        return fetch("https://tmi.twitch.tv/group/user/" + channel + "/chatters", {}).then((data) => {
            if(data.status == 200 && data.json.chatters) {
                return data.json;
            }
            else {
                throw "Couldn't get chatters for " + channel;
            }
        });
    },
    /**
     * @async
     * @param {string} channel - Name of the channel to get the rules for.
     * @returns {Array.<string>} Resolves to an array of rules for a chat.
     */
    getChatProperties(channel) {
        return fetch(`https://api.twitch.tv/api/channels/${channel}/chat_properties`).then((data) => {
            return data.json;
        });
    },
    getBuffer(channelId) {
        return fetch(`https://tmi.twitch.tv/api/rooms/${channelId}/recent_messages`, {}).then((data) => {
            return data.json.messages;
        });
    }
};
