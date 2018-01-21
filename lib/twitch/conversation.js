/*
 * Conversation implementation for Twitch
 */
"use strict";
//TODO has went live & gone offline messages?
//TODO Force accepting of language & freeform rules?

const { GenericConvChatPrototype } = require("resource:///modules/jsProtoHelper.jsm");
const { nsSimpleEnumerator } = require("resource:///modules/imXPCOMUtils.jsm");
const { addGlobalAllowedTag, addGlobalAllowedAttribute, addGlobalAllowedStyleRule, createDerivedRuleset } = require("resource:///modules/imContentSink.jsm");

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { setInterval, clearInterval, setTimeout } = require("sdk/timers");
const p = require("sdk/simple-prefs");
const { get: _ } = require("sdk/l10n");

const { Channel } = require("../irc");
const { Participant } = require("./participant");
const twitchAPI = require("./api");
const { escapeMsg } = require("../escape");
const { escapeForRegExp, replaceEmote, replaceEmoticon } = require("../emote-helpers");
const { getBadge } = require("./badge");

const bttv = require("../bttv");
const frankerfacez = require("../frankerfacez-api");

const twitchbots = require("jetpack-twitchbots");

const TOPIC_INTERVAL_PREF = "topic_refresh_interval";
const UPDATE_TOPIC_TOPIC = "chat-update-topic";
const BUILTINS = [ "tmi.twitch.tv", "twitchnotify", "jtv" ];

// Call to createDerivedRuleset so the global ruleset gets inited
createDerivedRuleset();
// Allow images in IM messages
addGlobalAllowedTag("img");
addGlobalAllowedAttribute("srcset");
addGlobalAllowedAttribute("sizes");
addGlobalAllowedAttribute("alt");
addGlobalAllowedAttribute("title");
addGlobalAllowedStyleRule("vertical-align");

const TwitchChannel = Class({
    extends: Channel,
    implements: [ Disposable ],
    initialize(account, convName, nick) {
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

        twitchAPI.getChatProperties(this._twitchName).then((properties) => {
            let message = _("rules_announcement");
            for(const rule of properties.chat_rules) {
                message += "\n - " + rule;
            }
            this.writeMessage("rules@api.twitch.tv", message, { system: true });

            return twitchAPI.getBuffer(properties._id).then((messages) => {
                messages.forEach((m) => this._account._socket.onDataReceived(m));
            });
        }).catch(() => this.WARN(`Couldn't get chat properties (rules and buffer) for ${this._twitchName}`));


        this._setTopicTimeout = this._setTopicTimeout.bind(this);
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
    _setTopicTimeout() {
        if(this._topicTimeoutId !== null) {
            clearInterval(this._topicTimeoutId);
        }

        this._topicTimeoutId = setInterval(() => {
            twitchAPI.getTitle(this._twitchName).then((title) => {
                if(title != this._topic) {
                    this._topic = title;
                    this.notifyObservers(null, UPDATE_TOPIC_TOPIC);
                }
            }, () => this.WARN("Could not get title for " + this._twitchName));
        }, p.prefs[TOPIC_INTERVAL_PREF] * 1000);
    },
    _setListTimeout() {
        if(this._listTimeoutId !== null) {
            clearInterval(this._listTimeoutId);
        }

        this._listTimeoutId = setInterval(() => {
            if(!this._chattersAdding) {
                twitchAPI.getChatters(this._twitchName).then((json) => {
                    this._viewerCount = json.chatter_count;
                    this._addChatters(json.chatters, this._isFilled);
                }, () => twitchAPI.getViewers(this._twitchName).then((viewers) => {
                    this._viewerCount = viewers;
                })).catch(() => this.WARN("Couldn't get chatters for " + this._twitchName));
            }
        }, p.prefs.participants_refresh_interval * 1000);
    },
    _chattersAdding: false,
    _addChatters(chatters, skipCheck = false) {
        // Don't run this function again if we're still working on adding the last ones.
        if(this._chattersAdding) {
            return;
        }

        const workOnQueue = (i, category, interval) => {
            this._chattersAdding = true;
            const participants = [];
            const goalIndex = Math.min(i + interval, chatters[category].length);
            let hadParticipant = true;
            let pa;
            while(i < goalIndex) {
                if(skipCheck) {
                    hadParticipant = this._hasParticipant(chatters[category][i]);
                }

                pa = this.getParticipant(chatters[category][i], !skipCheck, skipCheck);
                if(category === "moderators") {
                    pa.addBadge(this._getConversationBadge("mod"));
                }
                else if(category === "staff") {
                    pa.addBadge("staff");
                }
                else if(category === "global_mods") {
                    pa.addBadge("global_mod");
                }
                else if(category === "admins") {
                    pa.addBadge("admin");
                }

                if(skipCheck && !hadParticipant) {
                    participants.push(pa);
                }

                ++i;
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

            if(i < chatters[category].length && !this.left) {
                setTimeout(workOnQueue.bind(null, i, category, interval), 0);
            }
            else {
                this._chattersAdding = false;
            }
        };

        for(const category in chatters) {
            if(category !== "viewers" || (skipCheck && p.prefs.show_all_chatter)) {
                workOnQueue(0, category, skipCheck ? p.prefs.participants_adding_batch_size : chatters[category].length);
            }
        }

        if(this._isFilled) {
            const remove = false;
            this._participants.forEach((p, n) => {
                if(!p.halfOp && !chatters.viewers.includes(n) && n != this.normalizeNick(this._account.name)) {
                    this.removeParticipant(p.name);
                }
                //TODO remove badges?
            });
        }
    },
    dispose() {
        p.removeListener(TOPIC_INTERVAL_PREF, this._setTopicTimeout);
        p.removeListener("participants_refresh_interval", this._setListTimeout);
        clearInterval(this._topicTimeoutId);
        clearInterval(this._listTimeoutId);
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
    getParticipant(who, notifyObservers = false, noBotCheck = false) {
        if(this._participants.has(who)) {
            const participant = this._participants.get(who);
            if(who !== this.normalizeNick(who) && participant.name !== who) {
                this.updateNick(participant.name, who);
            }
            return participant;
        }

        if(BUILTINS.includes(who)) {
            return;
        }

        const participant = new Participant(who, this, null, noBotCheck);
        this._participants.set(who, participant);

        this._account.setWhois(participant.name, {
            badges: []
        });

        if(notifyObservers) {
            this.notifyObservers(new nsSimpleEnumerator([ participant ]),
                                   "chat-buddy-add");
        }

        return participant;
    },
    writeMessage(who, msg, obj) {
        if(!obj.system) {
            const participant = this.getParticipant(who, true);

            if(obj.outgoing && msg.search(/^\.[a-z]/i) !== -1) {
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
            ) {
                return;
            }
        }

        obj.containsNick = obj.incoming && this._pingRegexp.test(msg);

        const messageProps = this.handleTags(who, msg, obj);
        GenericConvChatPrototype.writeMessage.call(this, who, msg, messageProps);
    },
    prepareForDisplaying(msg) {
        if(msg.system) {
            if(!msg.escaped) {
                msg.displayMessage = escapeMsg(msg.displayMessage);
            }
            return;
        }

        if(msg.outgoing) {
            msg.displayMessage = escapeMsg(msg.displayMessage);
            const initialLength = msg.displayMessage.replace(/\s/g, "").length;
            let replacedLength = 0;
            for(let i = 0, emote; i < this._account._emotes.length; ++i) {
                emote = this._account._emotes[i];
                const [ displayMessage, occurences ] = replaceEmoticon(msg.displayMessage, emote.code, emote.id);
                replacedLength += occurences * emote.code.length;
                msg.displayMessage = displayMessage;
                if(replacedLength >= initialLength) {
                    break;
                }
            }
        }
        else if(!msg.escaped) {
            msg.displayMessage = escapeMsg(msg.displayMessage);
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
        this._account.sendMessage("PART", [ this.name ]);
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

        if(isOwnNick) {
            this.nick = newNick;
        }

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
