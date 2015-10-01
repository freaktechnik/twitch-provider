/*
 * Conversation implementation for Twitch
 */

const { Message } = require("resource:///modules/jsProtoHelper.jsm");
const { nsSimpleEnumerator } = require("resource:///modules/imXPCOMUtils.jsm");
const { addGlobalAllowedTag, addGlobalAllowedAttribute, addGlobalAllowedStyleRule, createDerivedRuleset } = require("resource:///modules/imContentSink.jsm");

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { setTimeout, removeTimeout } = require("sdk/timers");
const p = require("sdk/simple-prefs");

const { Channel } = require("../irc");
const { Participant } = require("./participant");
const twitchAPI = require("./api");
const { escapeMsg } = require("../escape");

const ACTION_START = "/me ";
const TOPIC_INTERVAL_PREF = "topic_refresh_interval";
const UPDATE_TOPIC_TOPIC = "chat-update-topic";

// See http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javscript-regex
const escapeForRegExp = (str) => str.replace(/[\-\[\]\/\(\)\{\}\*\+\?\.\\\^\$\|]/g, "\\$&");
const replaceEmoticon = (msg, code, id) => {
    // Replace emotes only if they are free standing
    let pattern = new RegExp("(^|\\s)"+code+"(?=\\s|$)", "g");
    let count = 0;
    let newMsg = msg.replace(pattern, (math, p1) => {
        ++count;
        return p1 + "<img alt='" + code + "' src='http://static-cdn.jtvnw.net/emoticons/v1/" + id + "/1.0' style='vertical-align: middle;'>"
    });
    return [ newMsg, count ];
};

// Call to createDerivedRuleset so the global ruleset gets inited
createDerivedRuleset();
// Allow images in IM messages
addGlobalAllowedTag("img");
addGlobalAllowedAttribute("src");
addGlobalAllowedAttribute("alt");
addGlobalAllowedStyleRule("vertical-align");

const TwitchChannel = Class({
    extends: Channel,
    implements: [ Disposable ],
    initialize: function(account, convName, nick) {
        Channel.call(this, account, convName, nick);
        // Twitch doesn't normalize..
        this._participants = new Map();

        let channelName = convName.slice(1);

        twitchAPI.canSetTitle(account._nickname, channelName).then((can) => {
            this._topicSettable = can;
        });

        twitchAPI.getTitle(channelName).then((title) => {
            this._topic = title;
            this.notifyObservers(null, UPDATE_TOPIC_TOPIC);
        });

        this._setTopicTimeout = this._setTopicTimeout.bind(this)

        this._setTopicTimeout();

        p.on(TOPIC_INTERVAL_PREF, this._setTopicTimeout);
    },
    _topicSettable: false,
    _topicTimeoutId: null,
    _setTopicTimeout: function() {
        this._topicTimeoutId = setTimeout(() => {
            twitchAPI.getTitle(this._name.slice(1)).then((title) => {
                if(title != this._topic) {
                    this._topic = title;
                    this.notifyObservers(null, UPDATE_TOPIC_TOPIC);
                }
            });
        }, p.prefs[TOPIC_INTERVAL_PREF] * 1000);
    },
    dispose: function() {
        removeTimeout(this._topicTimeoutId);
        p.removeListener(TOPIC_INTERVAL_PREF, this._setTopicTimeout);
    },
    getParticipant: function(who, notifyObservers) {
        if(this._participants.has(who))
            return this._participants.get(who);

        let participant = new Participant(who, this);
        this._participants.set(who, participant);

        this._account.setWhois(participant._name);

        if(notifyObservers) {
            this.notifyObservers(new nsSimpleEnumerator([participant]),
                                   "chat-buddy-add");
        }

        return participant;
    },
    writeMessage: function(who, msg, obj) {
        if(!msg.system) {
            if(this._participants.has(who.toLowerCase())) {
                this.updateNick(who.toLowerCase(), who);
            }
            this.getParticipant(who, true).setMeta(obj);
        }

        (new Message(who, msg, obj)).conversation = this;
    },
    prepareForDisplaying: function(msg) {
        let meta;
        if(!msg.system) {
            meta = this.getParticipant(msg.who);

            //TODO find a way that actually works to set the message color
            if(meta._color)
                msg.color = meta._color;
        }

        // This escapes all the existing entities, so nothing will be html.
        msg.displayMessage = escapeMsg(msg.displayMessage);

        if(msg.outgoing) {
            let initialLength = msg.displayMessage.replace(/\s/g, "").length;
            let replacedLength = 0;
            this.wrappedJSObject._account._emotes.every((emote) => {
                [ msg.displayMessage, occurences] = replaceEmoticon(msg.displayMessage, emote.code, emote.id);
                replacedLength += occurences * emote.code.length;
                return replacedLength < initialLength;
            });
        }
        else if(meta && meta._emotes.length) {
            meta._emotes.forEach((emote) => {
                let [id, firstBegin, firstEnd, ...occurences] = emote.split(/[-:,]/);

                if(msg.message.indexOf(ACTION_START) == 0) {
                    firstBegin = parseInt(firstBegin, 10) + ACTION_START.length;
                    firstEnd = parseInt(firstEnd, 10) + ACTION_START.length;
                }

                // extract the emote sequence from the initial message, since
                // the displayMessage potentially contains HTML tags by now.
                let emoteSequence = msg.message.substring(parseInt(firstBegin, 10), parseInt(firstEnd, 10)+1);

                [ msg.displayMessage ] = replaceEmoticon(msg.displayMessage, escapeForRegExp(emoteSequence), id);
            });
        }
    },
    get topicSettable() this._topicSettable,
    get topic() this._topic,
    set topic(newTopic) {
        if(this.topicSettable)
            twitchAPI.setTopic(this.title.slice(1), this._account._nickname, val);
    }
});

exports.TwitchChannel = TwitchChannel;
