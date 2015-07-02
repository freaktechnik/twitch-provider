/*
 * Twitch REST API stuff
 */

const { defer, all } = require("sdk/core/promise");
const { prefs } = require("sdk/simple-prefs");
const { Request } = require("sdk/request");

const NO_BADGE = "";

let headers = { Accept: "application/vnd.twitchtv.v3+json" };

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
            else
                throw "Can't set title";
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
        else
            p.reject("Not authorized.");

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
    getBadge: function(user, badgeType, channel) {
        let p = defer();
        let params = badgeType.split(":");
        if(badgeType == "broadcaster") {
            p.resolve(BROADCASTER_BADGE);
        }
        else if(params[0] == "mod" && channel == params[1]) {
            p.resolve(MOD_BADGE);
        }
        else if(params[0] == "sub" && channel == params[1]) {
            // get badge for subs in that channel
            p.resolve(badge);
        }
        else if(badgeType == "global_mod") {
            p.resolve(GLOBAL_MOD_BADGE);
        }
        else if(badgeType == "admin") {
            p.resolve(ADMIN_BADGE);
        }
        else if(badgeType == "staff") {
            p.resolve(STAFF_BADGE);
        }
        else if(badgeType == "turbo") {
            p.resolve(TURBO_BADGE);
        }
        else {
            p.resolve(NO_BADGE);
        }
        return p.promise;
    },
    getBadgesForUser: function(user, badges, channel) {
        if(user == channel.slice(1))
            badges = badges.concat(["broadcaster"]);

        return all(badges.map((b) => this.getBadge(user, b, channel))).then((actualBadges) => {
            return actualBadges.filter((aB) => aB !== NO_BADGE);
        });
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
                else
                    p.reject(data);
            }
        }).get();

        return p.promise;
    }
};
