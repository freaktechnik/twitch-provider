/*
 * Twitch chat participant
 */

const { GenericConvChatBuddyPrototype } = require("resource:///modules/jsProtoHelper.jsm");
const { Class } = require("sdk/core/heritage");
const twitchApi = require("./twitch-api");

const Participant = Class({
    extends: GenericConvChatBuddyPrototype,
    initialize: function(name, conv, meta) {
        this._name = name;
        this._conv = conv;
        this._account = conv._account;
        if(meta)
            this.setMeta(meta);
        twitchApi.getUserImage(name).then((img) => {
            this.buddyIconFilename = img;
        });
    },
    setMeta: function(meta) {
        this._color = meta.color;
        this._emotes = meta.emotes;
    }
});

exports.Participant = Participant;
