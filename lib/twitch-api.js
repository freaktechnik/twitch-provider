/*
 * Twitch REST API stuff
 */

const { defer, all } = require("sdk/core/defer");
const { prefs } = requires("sdk/simple-prefs");
const { Request } = require("sdk/request");

const NO_BADGE = "";

module.exports = {
    get title() {}
    set title(val) {
        if(this.canSetTitle) {
        }
    }
    setOAuth: function() {
        // needed for canSetTitle and setting the title
    }
    get canSetTitle() {},
    getUserImage: function(user) {
        let p = defer();
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

        return p.promise;
    }
};
