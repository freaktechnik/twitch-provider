/*
 * Conversation implementation for Twitch
 */
"use strict";
//TODO has went live & gone offline messages?

const { Message } = require("resource:///modules/jsProtoHelper.jsm");
const { nsSimpleEnumerator } = require("resource:///modules/imXPCOMUtils.jsm");
const { addGlobalAllowedTag, addGlobalAllowedAttribute, addGlobalAllowedStyleRule, createDerivedRuleset } = require("resource:///modules/imContentSink.jsm");

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { setInterval, removeInterval } = require("sdk/timers");
const p = require("sdk/simple-prefs");

const { Channel } = require("../irc");
const { Participant } = require("./participant");
const twitchAPI = require("./api");
const { escapeMsg } = require("../escape");
const { getBadge } = require("./badge");

const bttv = require("../bttv");
const frankerfacez = require("../frankerfacez-api");

const twitchbots = require("jetpack-twitchbots");
const { Cu } = require("chrome");

const ACTION_START = "/me ";
const TOPIC_INTERVAL_PREF = "topic_refresh_interval";
const UPDATE_TOPIC_TOPIC = "chat-update-topic";
const BUILTINS = [ "tmi.twitch.tv", "twitchnotify", "jtv" ];

const SIZES = {
    "1x": "1.0",
    "2x": "2.0"
};

// See http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javscript-regex
const escapeForRegExp = (str) => str.replace(/[\-\[\]\/\(\)\{\}\*\+\?\.\\\^\$\|]/g, "\\$&");
const replaceEmoticon = (msg, code, id) => {
    const imgUrl = "http://static-cdn.jtvnw.net/emoticons/v1/" + id +"/";
    const srcset = Object.keys(SIZES).map((x) => imgUrl + SIZES[x] + " " + x).join(",");
    return replaceEmote(msg, code, srcset);
};

// This is factored out of replaceEmoticon for generalization. I tend to avoid
// rewrites. Wait, that's actually a lie. But I'm lazy today.
const replaceEmote = (msg, code, srcset) => {
    // Replace emotes only if they are free standing
    const pattern = new RegExp("(^|\\s)"+code+"(?=\\s|$)", "g");
    let count = 0;
    const img = "<img alt='" + code + "' srcset='" + srcset + "' style='vertical-align: middle;'>";
    const newMsg = msg.replace(pattern, (math, p1) => {
        ++count;
        return p1 + img;
    });
    return [ newMsg, count ];
};

// Call to createDerivedRuleset so the global ruleset gets inited
createDerivedRuleset();
// Allow images in IM messages
addGlobalAllowedTag("img");
addGlobalAllowedAttribute("srcset");
addGlobalAllowedAttribute("sizes");
addGlobalAllowedAttribute("alt");
addGlobalAllowedStyleRule("vertical-align");

const TwitchChannel = Class({
    extends: Channel,
    implements: [ Disposable ],
    initialize: function(account, convName, nick) {
        Channel.call(this, account, convName.toLowerCase(), nick);

        this._twitchName = this._name.slice(1);

        twitchAPI.canSetTitle(this._twitchName, account._nickname).then((can) => {
            this._topicSettable = can;
            this.notifyObservers(this, UPDATE_TOPIC_TOPIC);
        }, () => this.WARN("Could not get editor info for " + this._twitchName));

        twitchAPI.getTitle(this._twitchName).then((title) => {
            this._topic = title;
            this.notifyObservers(this, UPDATE_TOPIC_TOPIC);
        }, () => this.WARN("Could not get title for " + this._twitchName));
        twitchAPI.getChatters(this._twitchName).then((json) => {
            this._viewerCount = json.chatter_count;
            this._addChatters(json.chatters, this._isFilled);
        }, () => twitchAPI.getViewers(this._twitchName).then((viewers) => {
            this._viewerCount = viewers;
        })).catch(() => this.WARN("Couldn't get chatters for " + this._twitchName));


        this._setTopicTimeout = this._setTopicTimeout.bind(this)
        this._setTopicTimeout();
        p.on(TOPIC_INTERVAL_PREF, this._setTopicTimeout);

        this._setListTimeout = this._setListTimeout.bind(this);
        this._setListTimeout();
        p.on("participants_refresh_interval", this._setListTimeout);

        this._bttvEmotes = [];
        this._frankerzEmotes = [];

        bttv.getChannelEmotes(this._twitchName).then((emotes) => {
            this._bttvEmotes = emotes;
        }, () => this.WARN("No bttv emotes for " + this._twitchName));
        frankerfacez.getChannelEmotes(this._twitchName).then((emotes) => {
            this._frankerzEmotes = emotes;
        }, () => this.WARN("No frankerfacez emotes for " + this._twitchName));
    },
    _topicSettable: false,
    _topicTimeoutId: null,
    _listTimeoutId: null,
    _bttvEmotes: [],
    _frankerzEmotes: [],
    _getConversationBadge(badge) {
        return getBadge(badge, this.name);
    },
    _setTopicTimeout: function() {
        if(this._topicTimeoutId !== null) {
            removeInterval(this._topicTimeoutId);
        }

        this._topicTimeoutId = setInterval(() => {
            twitchAPI.getTitle(this._twitchName).then((title) => {
                if(title != this._topic) {
                    this._topic = title;
                    this.notifyObservers(null, UPDATE_TOPIC_TOPIC);
                }
            }, () => this.WARN("Could not get title for "+this._twitchName));
        }, p.prefs[TOPIC_INTERVAL_PREF] * 1000);
    },
    _setListTimeout() {
        if(this._listTimeoutId !== null) {
            removeInterval(this._listTimeoutId);
        }

        this._listTimeoutId = setInterval(() => {
            twitchAPI.getChatters(this._twitchName).then((json) => {
                this._viewerCount = json.chatter_count;
                this._addChatters(json.chatters, this._isFilled);
            }, () => twitchAPI.getViewers(this._twitchName).then((viewers) => {
                this._viewerCount = viewers;
            })).catch(() => this.WARN("Couldn't get chatters for " + this._twitchName));
        }, p.prefs.participants_refresh_interval * 1000);
    },
    _addChatters(chatters, skipCheck = false) {
        //TODO batch up adding before "joining" the conv or make smaller bundles and setTimeout(0).
        const participants = [];
        let hadParticipant = true, p;
        for(let category in chatters) {
            if(category !== "viewers" || skipCheck) {
                chatters[category].forEach((user) => {
                    if(skipCheck)
                        hadParticipant = this._hasParticipant(user);

                    p = this.getParticipant(user, !skipCheck, skipCheck);
                    if(category === "moderators")
                        p.addBadge(this._getConversationBadge("mod"));
                    else if(category === "staff")
                        p.addBadge("staff");
                    else if(category === "global_mods")
                        p.addBadge("global_mod");
                    else if(category === "admins")
                        p.addBadge("admin");

                    if(skipCheck && !hadParticipant)
                        participants.push(p);
                });
            }
        }
        if(participants.length && skipCheck) {
            this.notifyObservers(new nsSimpleEnumerator(participants), "chat-buddy-add");
            twitchbots.getBots(participants.map((p) => p.name)).then((bots) => {
                let botParticipant;
                bots.forEach((bot) => {
                    if(bot.isBot) {
                        botParticipant = this.getParticipant(bot.username);
                        botParticipant.addBadge("bot");
                    }
                });
            });
        }
        if(this._isFilled) {
            let remove = false;
            this._participants.forEach((p, n) => {
                if((!p.halfOp) && !chatters.viewers.includes(n))
                    this.removeParticipant(p.name);
                //TODO remove badges?
            });
        }
    },
    dispose() {
        p.removeListener(TOPIC_INTERVAL_PREF, this._setTopicTimeout);
        p.removeListener("participants_refresh_interval", this._setListTimeout);
        removeInterval(this._topicTimeoutId);
        removeInterval(this._listTimeoutId);
    },
    unInit() {
        this.dispose();
        Channel.prototype.unInit.call(this);
    },
    _viewerCount: 0,
    // Returns true, if twitch probably isn't sending joins and parts of everyone.
    get _isFilled() {
        return this._participants.size >= 1000 || this._viewerCount >= 1000;
    },
    broadcasterLanguage: "",
    _hasParticipant(who) {
        return BUILTINS.includes(who) || this._participants.has(who);
    },
    getParticipant: function(who, notifyObservers = false, noBotCheck = false) {
        if(this._participants.has(who))
            return this._participants.get(who);

        if(BUILTINS.includes(who))
            return;

        let participant = new Participant(who, this, null, noBotCheck);
        this._participants.set(who, participant);

        this._account.setWhois(participant._name, {
            badges: []
        });

        if(notifyObservers) {
            this.notifyObservers(new nsSimpleEnumerator([participant]),
                                   "chat-buddy-add");
        }

        return participant;
    },
    writeMessage: function(who, msg, obj) {
        if(!obj.system) {
            const normalized = this.normalizeNick(who);
            if(normalized !== who && this._participants.get(normalized).name === normalized) {
                this.updateNick(normalized, who);
            }
            const participant = this.getParticipant(who, true);
            participant.setMeta(obj);

            if(obj.outgoing && msg[0] === ".") {
                msg = "/" + msg.substr(1);
            }

            if(obj.incoming && !obj.system &&
              (
                p.prefs.ignore_bots && participant.hasBadge("bot") ||
                (
                  p.prefs.ignored_messages.length > 0 &&
                  p.prefs.ignored_messages.split(",").map((m) => m.trim()).includes(msg.trim())
                )
              )
            )
                return;
        }

        (new Message(who, msg, obj)).conversation = this;
    },
    prepareForDisplaying: function(msg) {
        // This escapes all the existing entities, so nothing will be html, though twitch seems to pre-escape
        //TODO Avoid double escaping incoming XML entities somehow.
        msg.displayMessage = escapeMsg(msg.displayMessage);

        if(msg.system)
            return;

        if(msg.outgoing) {
            const initialLength = msg.displayMessage.replace(/\s/g, "").length;
            let replacedLength = 0;
            this.wrappedJSObject._account._emotes.every((emote) => {
                const [ displayMessage, occurences ] = replaceEmoticon(msg.displayMessage, emote.code, emote.id);
                replacedLength += occurences * emote.code.length;
                msg.displayMessage = displayMessage;
                return replacedLength < initialLength;
            });
        }
        else {
            const meta = this.getParticipant(msg.who);
            if(meta._color)
                msg.color = meta._color;

            if("_emotes" in meta && meta._emotes && meta._emotes.length) {
                meta._emotes.forEach((emote) => {
                    let [id, firstBegin, firstEnd, ...occurences] = emote.split(/[-:,]/);

                    if(msg.message.indexOf(ACTION_START) == 0) {
                        firstBegin = parseInt(firstBegin, 10) + ACTION_START.length;
                        firstEnd = parseInt(firstEnd, 10) + ACTION_START.length;
                    }

                    // extract the emote sequence from the initial message, since
                    // the displayMessage potentially contains HTML tags by now.
                    const emoteSequence = msg.message.substring(parseInt(firstBegin, 10), parseInt(firstEnd, 10)+1);

                    msg.displayMessage = replaceEmoticon(msg.displayMessage, escapeForRegExp(emoteSequence), id)[0];
                });
            }
        }

        const doReplace = (emote) => {
            msg.displayMessage = replaceEmote(msg.displayMessage, escapeForRegExp(emote.code), emote.srcset)[0];
        };

        if(bttv.enabled) {
            bttv.cachedGlobalEmotes.forEach(doReplace);
            this._bttvEmotes.forEach(doReplace);
        }
        if(frankerfacez.enabled) {
            frankerfacez.cachedGlobalEmotes.forEach(doReplace);
            this._frankerzEmotes.forEach(doReplace);
        }
    },
    get topicSettable() {
        return this._topicSettable;
    },
    get topic() {
        return this._topic;
    },
    set topic(newTopic) {
        if(this.topicSettable) {
            twitchAPI.setTitle(this._twitchName, this._account._nickname, newTopic).then(() => {
                this._topic = newTopic;
                this.notifyObservers(this, UPDATE_TOPIC_TOPIC);
            }, () => {
                this._topicSettable = false;
                this.notifyObservers(this, UPDATE_TOPIC_TOPIC);
            });
        }
    },
    part() {
        this._account.sendMessage("PART", [this.name]);
    },
    setMode(newMode, params, setter) {
        //TODO some channel modes still come through
        if(params.length) {
            Channel.prototype.setMode.call(this, newMode, params, setter);
        }
        else {
            /* no mode changes for channels */
        }
    },
    updateNick(oldNick, newNick, isOwnNick) {
        const isParticipant = this._participants.has(oldNick);

        if(isOwnNick)
            this.nick = newNick;

        if(!isParticipant) {
            this.ERROR("Trying to rename nick that doesn't exist! " + oldNick +
                 " to " + newNick);
            return;
        }

        const participant = this._participants.get(oldNick);
        this._participants.delete(oldNick);

        participant.name = newNick;
        this._participants.set(newNick, participant);

        this.notifyObservers(participant, "chat-buddy-update", oldNick);
    }
});

exports.TwitchChannel = TwitchChannel;
