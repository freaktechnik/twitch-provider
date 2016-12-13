/*
 * BTTV API module
 */
"use strict";

const { Request } = require("sdk/request");
const { cache, memoize } = require("sdk/lang/functional");
const { defer } = require("sdk/core/promise");
const preferences = require("sdk/simple-prefs");
const { prefs } = preferences;

const baseURL = "https://api.betterttv.net/2/";
const SIZES = [ "1x", "2x", "3x" ];
const ENABLE_PREF = "bttv_emotes_enabled";

let cachedGlobalEmotes = [];

module.exports = {
    getGlobalEmotes: cache(() => {
        let { promise, resolve, reject } = defer();

        Request({
            url: baseURL + "emotes/",
            onComplete: (data) => {
                if(data.json && data.json.status == 200) {
                    cachedGlobalEmotes = data.json.emotes.map((emote) => ({
                        code: emote.code,
                        srcset: SIZES.map((x) => "https:" + data.json.urlTemplate.replace("{{id}}", emote.id).replace("{{image}}", x) + " " + x).join(",")
                    }));
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
            url: baseURL + "channels/" + channel,
            onComplete: (data) => {
                if(data.json && data.json.status == 200) {
                    resolve(data.json.emotes.map((emote) => ({
                        code: emote.code,
                        srcset: SIZES.map((x) => "https:" + data.json.urlTemplate.replace("{{id}}", emote.id).replace("{{image}}", x) + " " + x).join(",")
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
