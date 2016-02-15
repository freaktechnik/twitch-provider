/*
 * Conversation implementation for Twitch
 */
//TODO has went live & gone offline messages?

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

const bttv = require("../bttv");
const frankerfacez = require("../frankerfacez-api");

const twitchbots = require("jetpack-twitchbots");
const { Cu } = require("chrome");

const { BADGE_CHANNEL_SPLITTER } = require("./const");

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
    let imgUrl = "http://static-cdn.jtvnw.net/emoticons/v1/" + id +"/";
    let srcset = Object.keys(SIZES).map((x) => imgUrl + SIZES[x] + " " + x).join(",");
    return replaceEmote(msg, code, srcset);
};

// This is factored out of replaceEmoticon for generalization. I tend to avoid
// rewrites. Wait, that's actually a lie. But I'm lazy today.
const replaceEmote = (msg, code, srcset) => {
    // Replace emotes only if they are free standing
    let pattern = new RegExp("(^|\\s)"+code+"(?=\\s|$)", "g");
    let count = 0;
    let img = "<img alt='" + code + "' srcset='" + srcset + "' style='vertical-align: middle;'>";
    let newMsg = msg.replace(pattern, (math, p1) => {
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
addGlobalAllowedAttribute("alt");
addGlobalAllowedStyleRule("vertical-align");

const TwitchChannel = Class({
    extends: Channel,
    implements: [ Disposable ],
    initialize: function(account, convName, nick) {
        Channel.call(this, account, convName, nick);

        this._twitchName = this._name.slice(1).toLowerCase();

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
    _setTopicTimeout: function() {
        if(this._topicTimeoutId !== null) {
            removeTimeout(this._topicTimeoutId);
        }

        this._topicTimeoutId = setTimeout(() => {
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
            removeTimeout(this._listTimeoutId);
        }

        this._listTimeoutId = setTimeout(() => {
            twitchAPI.getChatters(this._twitchName).then((json) => {
                this._viewerCount = json.chatter_count;
                this._addChatters(json.chatters, this._isFilled);
            }, () => twitchAPI.getViewers(this._twitchName).then((viewers) => {
                this._viewerCount = viewers;
            })).catch(() => this.WARN("Couldn't get chatters for " + this._twitchName));
        });
    },
    _addChatters(chatters, skipCheck = false) {
        //TODO make this actually perform by not having to be an O(2n^2) operation.
        const participants = [];
        let hadParticipant, p;
        for(let category in chatters) {
            if(category !== "viewers" || skipCheck) {
                chatters[category].forEach((user) => {
                    hadParticipant = skipCheck;
                    if(skipCheck)
                        hadParticipant = this._hasParticipant(user);

                    p = this.getParticipant(user, !skipCheck, skipCheck);
                    if(category === "moderators")
                        p.addBadge("mod"+BADGE_CHANNEL_SPLITTER+this.name);
                    else if(category === "staff")
                        p.addBadge("staff");
                    else if(category === "global_mods")
                        p.addBadge("global_mod");
                    else if(category === "admins")
                        p.addBadge("admin");
                    else if(skipCheck)
                        //p.queuePart();
                        //TODO do explicit parts to avoid 10000 timers.

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
    },
    dispose() {
        p.removeListener(TOPIC_INTERVAL_PREF, this._setTopicTimeout);
        p.removeListener("participants_refresh_interval", this._setListTimeout);
        removeTimeout(this._topicTimeoutId);
        removeTimeout(this._listTimeoutId);
    },
    _viewerCount: 0,
    // Returns true, if twitch probably isn't sending joins and parts of everyone.
    get _isFilled() {
        return this._participants.size >= 1000 || this._viewerCount > 1000;
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
            let normalized = this.normalizeNick(who);
            if(normalized !== who && this._participants.get(normalized).name === normalized) {
                this.updateNick(normalized, who);
            }
            let participant = this.getParticipant(who, true);
            participant.setMeta(obj);

            // Correct incoming messages from the twitch user to outgoing.
            if(who == this._account._nickname && !obj.outgoing) {
                obj.outgoing = true;
                obj.incoming = false;
            }

            if(obj.outgoing && msg[0] === ".") {
                msg = "/" + msg.substr(1);
            }

            if(who !== this._account._nickname && this._isFilled &&
               (!participant.op || participant.halfOp || participant.founder)) {
                //TODO this should also be retroactive.
                participant.queuePart();
            }
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

        this._participants.forEach((participant) => {
            msg.displayMessage = msg.displayMessage.replace(new RegExp("((?:^|\\W)@?)"+participant._name+"(?=\\W|$)", "gi"), (m, p) => p + participant._name);
        });

        // This escapes all the existing entities, so nothing will be html, though twitch seems to pre-escape
        //TODO skip for incoming?
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

        const doReplace = (emote) => {
            [ msg.displayMessage ] = replaceEmote(msg.displayMessage, escapeForRegExp(emote.code), emote.srcset);
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
