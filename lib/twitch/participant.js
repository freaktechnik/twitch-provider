/*
 * Twitch chat participant
 */

const { GenericConvChatBuddyPrototype } = require("resource:///modules/jsProtoHelper.jsm");
const { Class } = require("sdk/core/heritage");
const twitchApi = require("./api");
const { BADGE_CHANNEL_SPLITTER } = require("./const");
const { ircHandlers } = require("resource:///modules/ircHandlers.jsm");
const { debounce } = require("sdk/lang/functional");

const GLOBAL_OPS = [ "global_mod", "admin", "staff" ];

const Participant = Class({
    extends: GenericConvChatBuddyPrototype,
    initialize: function(name, conv, meta) {
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
        if(!this._badges.includes(badge)) {
            this._badges.push(badge);
            this._account.addBadgeToUser(this._name, badge);
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
        return this._conv.name.toLowerCase() === "#"+this._name.toLowerCase();
    },
    get voiced() {
        return this._badges.includes("sub"+BADGE_CHANNEL_SPLITTER+this._conv.name);
    },
    get op() {
        return this._op || this.founder ||
               this._badges.some((badge) => GLOBAL_OPS.includes(badge)) ||
               this._badges.includes("mod"+BADGE_CHANNEL_SPLITTER+this._conv.name);
    },
    part() {
        if(this._conv._isFilled) {
            let name = this._name.toLowerCase();
            ircHandlers.handleMessage(this._account, {
                command: "PART",
                params: [ this._conv.name ],
                origin: name,
                source: name+"@"+name+".tmi.twitch.tv"
            });
        }
    },
    queuePart: debounce(function() {
        this.part();
    }, 30000)
});

exports.Participant = Participant;
