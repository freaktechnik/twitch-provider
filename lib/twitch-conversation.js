/*
 * Conversation implementation for Twitch
 */

//TODO use display names for users in the user list

const { Message } = require("resource:///modules/jsProtoHelper.jsm");
const { addGlobalAllowedTag, addGlobalAllowedAttribute, addGlobalAllowedStyleRule, createDerivedRuleset } = require("resource:///modules/imContentSink.jsm");

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { setTimeout, removeTimeout } = require("sdk/timers");

const { Channel } = require("./irc");
const twitchAPI = require("./twitch-api");

const ACTION_START = "/me ";

// See http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javscript-regex
const escapeForRegExp = (str) => str.replace(/[\-\[\]\/\(\)\{\}\*\+\?\.\\\^\$\|]/g, "\\$&");
const replaceEmoticon = (msg, code, id) => msg.replace(new RegExp("(^|\\s)("+code+")(?=\\s|$)", "g"), "$1<img alt='$2' src='http://static-cdn.jtvnw.net/emoticons/v1/"+id+"/1.0' style='vertical-align: middle;'>")

// Call to createDerivedRuleset so the global ruleset gets inited
createDerivedRuleset();
addGlobalAllowedTag("img");
addGlobalAllowedAttribute("src");
addGlobalAllowedAttribute("alt");
addGlobalAllowedStyleRule("vertical-align");

let msgMeta = new Map();

const TwitchMessage = Class({
    extends: Message,
    implements: [ Disposable ],
    initialize: function(who, text, obj, conv) {
        msgMeta.set(this._lastId+1, obj);
        this._init(who, text, obj);
        this.conversation = conv;
    },
    dispose: function() {
        if(msgMeta.has(this.id)) {
            msgMeta.delete(this.id);
        }
    }
});

const TwitchChannel = Class({
    extends: Channel,
    implements: [ Disposable ],
    initialize: function(account, convName, nick) {
        Channel.call(this, account, convName, nick);

        let channelName =convName.slice(1);

        twitchAPI.canSetTitle(account._nickname, channelName).then((can) => {
            this._topicSettable = can;
        });

        twitchAPI.getTitle(channelName).then((title) => {
            this._topic = title;
            this.notifyObservers(null, "chat-update-topic");
        });

        this._topicTimeoutId = setTimeout(() => {
            twitchAPI.getTitle(channelName).then((title) => {
                if(title != this._topic) {
                    this._topic = title;
                    this.notifyObservers(null, "chat-update-topic");
                }
            });
        }, 120000); //TODO make this a pref
    },
    _topicSettable: false,
    _topicTimeoutId: null,
    dispose: function() {
        removeTimeout(this._topicTimeoutId);
    },
    writeMessage: function(who, msg, obj) {
        new TwitchMessage(who, msg, obj, this);
    },
    prepareForDisplaying: function(msg) {
        let meta;
        if(!msg.system) {
            meta = msgMeta.get(msg.id);
            msgMeta.delete(msg.id);

            //TODO find a way that actually works to set the message color
            if(meta.color)
                msg.color = meta.color;
        }

        Channel.prototype.prepareForDisplaying.call(this, msg);

        if(meta && meta.emotes) {
            meta.emotes.forEach((emote) => {
                let [id, firstBegin, firstEnd, ...occurences] = emote.split(/[-:,]/);

                if(msg.message.indexOf(ACTION_START) == 0) {
                    firstBegin = parseInt(firstBegin, 10) + ACTION_START.length;
                    firstEnd = parseInt(firstEnd, 10) + ACTION_START.length;
                }

                let emoteSequence = msg.message.substring(parseInt(firstBegin, 10), parseInt(firstEnd, 10)+1);

                msg.displayMessage = replaceEmoticon(msg.displayMessage, escapeForRegExp(emoteSequence), id);
            });
        }

        if(meta && meta.outgoing) {
            this.wrappedJSObject._account._emotes.forEach((emote) => {
                msg.displayMessage = replaceEmoticon(msg.displayMessage, emote.code, emote.id);
            });
        }
    },
    get topicSettable() this._topicSettable,
    get topic() this._topic,
    set topic(newTopic) {
        if(this.topicSettable)
            twitchAPI.setTopic(this.title.slice(1), this._account._nickname, val);
    },
    get topicSetter() this.title
    //TODO getParticipants()?
});

exports.TwitchChannel = TwitchChannel;
