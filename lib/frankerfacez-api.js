/*
 * FrankerFaceZ API module
 */
"use strict";

const { Request } = require("sdk/request");
const { cache, memoize } = require("sdk/lang/functional");
const { defer } = require("sdk/core/promise");
const { flatten } = require("sdk/util/array");
const preferences = require("sdk/simple-prefs");
const { prefs } = preferences;

const baseURL = "https://api.frankerfacez.com/v1/";
const ENABLE_PREF = "frankerfacez_emotes_enabled";

let cachedGlobalEmotes = [];

module.exports = {
    getGlobalEmotes: cache(() => {
        let { promise, resolve, reject } = defer();

        Request({
            url: baseURL + "set/global",
            onComplete: (data) => {
                if(data.json && "sets" in data.json) {
                    cachedGlobalEmotes = flatten(data.json.default_sets.map((id) => data.json.sets[id + ""].emoticons.map((emote) => ({
                        code: emote.name,
                        srcset: Object.keys(emote.urls).map((x) => "https:" + emote.urls[x] + " " + x + "x").join(",")
                    }))));

                    resolve(cachedGlobalEmotes);
                }
                else {
                    reject(data);
                }
            }
        }).get();

        return promise;
    }),
    get cachedGlobalEmotes() {
        return cachedGlobalEmotes;
    },
    getChannelEmotes: memoize((channel) => {
        let { promise, resolve, reject } = defer();

        Request({
            url: baseURL + "room/" + channel,
            onComplete: (data) => {
                if(data.json && "room" in data.json) {
                    resolve(data.json.sets[data.json.room.set].emoticons.map((emote) => ({
                        code: emote.name,
                        srcset: Object.keys(emote.urls).map((x) => "https:" + emote.urls[x] + " " + x + "x").join(",")
                    })));
                }
                else {
                    reject(data);
                }
            }
        }).get();

        return promise;
    }),
    get enabled() {
        return prefs[ENABLE_PREF];
    }
};

preferences.on(ENABLE_PREF, () => {
    if(module.exports.enabled) {
        // warm it up
        module.exports.getGlobalEmotes();
    }
});

if(module.exports.enabled) {
    module.exports.getGlobalEmotes();
}
