/*
 * Twitch chat participant
 */

const { GenericConvChatBuddyPrototype } = require("resource:///modules/jsProtoHelper.jsm");
const { Class } = require("sdk/core/heritage");
const twitchApi = require("./api");
const { BADGE_CHANNEL_SPLITTER } = require("./const");
const { ircHandlers } = require("resource:///modules/ircHandlers.jsm");
const { debounce } = require("sdk/lang/functional");
const twitchbots = require("jetpack-twitchbots");
const { prefs } = require("sdk/simple-prefs");

const GLOBAL_OPS = [ "global_mod", "admin", "staff" ];
const SWAG_BADGES = [ "turbo", "bot" ];

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
            if(!SWAG_BADGES.includes(badge) && !(this._op && badge.startsWith("mod")))
                this._conv.notifyObservers(this, "chat-buddy-update");
        }
    },
    hasBadge(badge) {
        return this._badges.includes(badge);
    },
    removeBadge(badge) {
        if(this.hasBadge(badge)) {
            this._badges.splice(this._badges.indexOf(badge), 1);
            this._account._removeBadgeFromUser(this._name, badge);
            if(!SWAG_BADGES.includes(badge))
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
        return this._conv.name === "#"+this._conv.normalizeNick(this._name);
    },
    get voiced() {
        return this._badges.includes("sub"+BADGE_CHANNEL_SPLITTER+this._conv.name);
    },
    get op() {
        return this._badges.some((badge) => GLOBAL_OPS.includes(badge));
    },
    get halfOp() {
        return this._op || this._badges.includes("mod"+BADGE_CHANNEL_SPLITTER+this._conv.name);
    },
    part() {
        if(this._conv._isFilled)
            this._conv.removeParticipant(this._name);
    },
    queuePart: debounce(function() {
        this.part();
    }, prefs.user_timeout * 1000)
});

exports.Participant = Participant;
