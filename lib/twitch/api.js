/*
 * Twitch REST API stuff
 */

const { defer, all } = require("sdk/core/promise");
const { prefs } = require("sdk/simple-prefs");
const { Request } = require("sdk/request");

const { BADGE_CHANNEL_SPLITTER } = require("./const");


const NO_BADGE = "";
const baseURL = "https://api.twitch.tv/kraken/";

let headers = {
    Accept: "application/vnd.twitchtv.v3+json",
    "Client-ID": prefs.id
};
let badges = new Map();

module.exports = {
    getViewers(channel) {
        let p = defer();

        Request({
            url: baseURL+"streams/"+channel,
            headers,
            onComplete(data) {
                if(data.json) {
                    if("stream" in data.json && data.json.stream !== null)
                        p.resolve(data.json.stream.viewers);
                    else
                        p.resolve(0);
                }
                else {
                    p.reject(data);
                }
            }
        }).get();

        return p.promise;
    },
    getTitle(channel) {
        let p = defer();

        Request({
            url: baseURL+"channels/"+channel,
            headers,
            onComplete(data) {
                if(data.json && data.status !== 404)
                    p.resolve(data.json.status);
                else
                    p.reject(data);
            }
        }).get();

        return p.promise;
    },
    // needs the channel_editor scope
    setTitle(channel, user, title) {
        return this.canSetTitle(channel, user).then((can) => {
            if(can) {
                let { promise, resolve, reject } = defer();
                Request({
                    url: baseURL+"channels/"+channel,
                    headers,
                    content: {channel: {status: title}},
                    onComplete(data) {
                        if(data.status == 200)
                            resolve(title);
                        else
                            reject(data);
                    }
                }).put();
                return promise;
            }
            else {
                throw "Can't set title";
            }
        });
    },
    setOAuth(token) {
        headers.Authorization = "OAuth "+token;
    },
    canSetTitle(channel, user) {
        let p = defer();

        if("Authorization" in headers) {
            p.resolve(channel === user);
            // There is currently no way to check a user's editing rights on other channels.
        }
        else {
            p.reject("Not authorized");
        }

        return p.promise;
    },
    getUserImage(user) {
        let p = defer();

        Request({
            url: baseURL+"users/"+user,
            headers,
            onComplete(data) {
                if(data.json)
                    p.resolve(data.json.logo);
                else
                    p.reject(data);
            }
        }).get();

        return p.promise;
    },
    getBadgesForChannel: function(channel) {
        let { promise, resolve, reject } = defer();

        if(badges.has(channel)) {
            resolve(badges.get(channel));
        }
        else {
            Request({
                url: baseURL+"chat/"+channel+"/badges",
                headers,
                onComplete(data) {
                    if(!data.json || data.status > 399) {
                        p.reject(data.json || data.text);
                    }
                    else {
                        badges.set(channel, data.json);
                        resolve(data.json);
                    }
                }
            }).get();
        }

        return promise;
    },
    getBadge(user, badgeType, channel) {
        let params = badgeType.split(BADGE_CHANNEL_SPLITTER);

        return this.getBadgesForChannel(channel).then((badges) => {
            if(params.length > 1) {
                if(params[1] == channel && params[0] in badges && badges[params[0]]) {
                    return badges[params[0]].image;
                }
                else {
                    return NO_BADGE;
                }
            }
            else if(badgeType in badges && badges[badgeType]) {
                return badges[badgeType].image;
            }
            else {
                return NO_BADGE;
            }
        });
    },
    getBadgesForUser(user, badges, channel) {
        if(user == channel.slice(1))
            badges = badges.concat(["broadcaster"]);

        return this.getBadgesForChannel(channel).then(
            all(badges.map((b) => this.getBadge(user, b, channel))).then((actualBadges) => {
                return actualBadges.filter((aB) => aB !== NO_BADGE);
            })
        );
    },
    getEmoteSets(sets) {
        let p = defer();

        Request({
            url: baseURL+"chat/emoticon_images?emotesets="+sets,
            headers,
            onComplete(data) {
                if(data.json) {
                    let emoticons = [];
                    for(let set in data.json.emoticon_sets) {
                        emoticons = emoticons.concat(data.json.emoticon_sets[set]);
                    }
                    p.resolve(emoticons);
                }
                else {
                    p.reject(data);
                }
            }
        }).get();

        return p.promise;
    },
    getChatters(channel) {
        const p = defer();

        Request({
            url: "https://tmi.twitch.tv/group/user/"+channel+"/chatters",
            onComplete(data) {
                if(data.status == 200 && data.json.chatters)
                    p.resolve(data.json);
                else
                    p.reject("Couldn't get chatters for "+channel);
            }
        }).get();

        return p.promise;
    }
};
