/*
 * Twitch REST API stuff
 */

const { defer, all } = require("sdk/core/promise");
const { prefs } = require("sdk/simple-prefs");
const { Request } = require("sdk/request");


const NO_BADGE = "";

let headers = { Accept: "application/vnd.twitchtv.v3+json" };
let badges = new Map();

module.exports = {
    getTitle: function(channel) {
        let p = defer();

        Request({
            url: "https://api.twitch.tv/kraken/channels/"+channel,
            headers: headers,
            onComplete: function(data) {
                if(data.json)
                    p.resolve(data.json.status);
                else
                    p.reject(data);
            }
        }).get();

        return p.promise;
    },
    // needs the channel_editor scope
    setTitle: function(channel, user, title) {
        return this.canSetTitle(channel, user).then((can) => {
            if(can) {
                Request({
                    url: "https://api.twitch.tv/kraken/channels/"+channel,
                    headers: headers,
                    content: {channel: {status: title}}
                }).put();
                return title;
            }
            else {
                throw "Can't set title";
            }
        });
    },
    setOAuth: function(token) {
        headers.Authorization = "OAuth "+token;
    },
    // needs the channel_read scope
    canSetTitle: function(channel, user) {
        let p = defer();

        if(headers.Authorization) {
            Request({
                url: "https://api.twitch.tv/kraken/channels/"+channel+"/editors",
                headers: headers,
                onComplete: function(data) {
                    if(data.json)
                        p.resolve(data.json.users && data.json.users.some((user) => user.name == user));
                    else
                        p.reject(data);
                }
            }).get();
        }
        else {
            p.reject("Not authorized.");
        }

        return p.promise;
    },
    getUserImage: function(user) {
        let p = defer();

        Request({
            url: "https://api.twitch.tv/kraken/users/"+user,
            headers: headers,
            onComplete: function(data) {
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
                url: "https://api.twitch.tv/kraken/chat/"+channel+"/badges",
                headers: headers,
                onComplete: function(data) {
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
    getBadge: function(user, badgeType, channel) {
        let params = badgeType.split(":");

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
    getBadgesForUser: function(user, badges, channel) {
        if(user == channel.slice(1))
            badges = badges.concat(["broadcaster"]);

        return this.getBadgesForChannel(channel).then(
            all(badges.map((b) => this.getBadge(user, b, channel))).then((actualBadges) => {
                return actualBadges.filter((aB) => aB !== NO_BADGE);
            })
        );
    },
    getEmoteSets: function(sets) {
        let p = defer();

        Request({
            url: "https://api.twitch.tv/kraken/chat/emoticon_images?emotesets="+sets,
            headers: headers,
            onComplete: function(data) {
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
    }
};
