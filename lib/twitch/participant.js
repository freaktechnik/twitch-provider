/*
 * Twitch chat participant
 */

const { GenericConvChatBuddyPrototype } = require("resource:///modules/jsProtoHelper.jsm");
const { Class } = require("sdk/core/heritage");
const twitchApi = require("./api");
const { ircHandlers } = require("resource:///modules/ircHandlers.jsm");
const twitchbots = require("jetpack-twitchbots");
const { DECORATIVE_BADGES, getBadge } = require("./badge");

const GLOBAL_OPS = [ "global_mod", "admin", "staff" ];

const Participant = Class({
    extends: GenericConvChatBuddyPrototype,
    initialize: function(name, conv, meta = null, noBotCheck = false) {
        this._name = name;
        this._conv = conv;
        this._account = conv._account;
        this._emotes = [];
        this._badges = [];
        if(meta)
            this.setMeta(meta);
        twitchApi.getUserImage(name).then((img) => {
            this.buddyIconFilename = img;
        });

        if(!noBotCheck) {
            twitchbots.getBot(name).then((bot) => {
                if(bot.isBot)
                    this.addBadge("bot");
            });
        }
    },
    _color: "",
    _emotes: [],
    _badges: [],
    _op: false,
    buddyIconFilename: undefined,
    setMeta: function(meta) {
        this._color = meta.color;
        this._emotes = meta.emotes;
    },
    addBadge: function(badge) {
        if(!this.hasBadge(badge)) {
            this._badges.push(badge);
            this._account.addBadgeToUser(this._name, badge);
            if(!DECORATIVE_BADGES.includes(badge) && !(this._op && badge.startsWith("mod")))
                this._conv.notifyObservers(this, "chat-buddy-update");
        }
    },
    hasBadge(badge) {
        return this._badges.includes(getBadge(badge, this._conv.name));
    },
    removeBadge(badge) {
        if(this.hasBadge(badge)) {
            this._badges.splice(this._badges.indexOf(badge), 1);
            this._account.removeBadgeFromUser(this._name, badge);
            if(!DECORATIVE_BADGES.includes(badge))
                this._conv.notifyObservers(this, "chat-buddy-update");
        }
    },
    setMode: function(add, mode) {
        if(mode.includes("o")) {
            this._op = add;
            this._conv.notifyObservers(this, "chat-buddy-update");
        }
    },
    get typing() {
        return false;
    },
    get founder() {
        return this._conv._twitchName === this._conv.normalizeNick(this._name);
    },
    get voiced() {
        return this._badges.includes(this._conv._getConversationBadge("sub"));
    },
    get op() {
        return this._badges.some((badge) => GLOBAL_OPS.includes(badge));
    },
    get halfOp() {
        return this._op || this._badges.includes(this._conv._getConversationBadge("mod")) || this.op || this.founder;
    }
});

exports.Participant = Participant;
