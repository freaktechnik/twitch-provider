/*
 * Conversation implementation for Twitch
 */
"use strict";
//TODO has went live & gone offline messages?

const { GenericConvChatPrototype } = require("resource:///modules/jsProtoHelper.jsm");
const { nsSimpleEnumerator } = require("resource:///modules/imXPCOMUtils.jsm");
const { addGlobalAllowedTag, addGlobalAllowedAttribute, addGlobalAllowedStyleRule, createDerivedRuleset } = require("resource:///modules/imContentSink.jsm");

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { setInterval, clearInterval, setTimeout } = require("sdk/timers");
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
const getTwitchSrcset = (id) => {
    const imgUrl = "http://static-cdn.jtvnw.net/emoticons/v1/" + id +"/";
    return Object.keys(SIZES).map((x) => imgUrl + SIZES[x] + " " + x).join(",");
};
const getImg = (name, srcset) => "<img alt='" + name + "' title='" + name + "' srcset='" + srcset + "' style='vertical-align: middle;'>"
const replaceEmoticon = (msg, code, id) => {
    const srcset = getTwitchSrcset(id);
    return replaceEmote(msg, code, srcset);
};

// This is factored out of replaceEmoticon for generalization. I tend to avoid
// rewrites. Wait, that's actually a lie. But I'm lazy today.
const replaceEmote = (msg, code, srcset) => {
    // Replace emotes only if they are free standing
    const pattern = new RegExp("(^|\\s)"+code+"(?=\\s|$)", "g");
    let count = 0;
    const newMsg = msg.replace(pattern, (math, p1) => {
        ++count;
        return p1 + getImg(math, srcset);
    });
    return [ newMsg, count ];
};

const replaceCharacters = (msg, start, end, srcset) => {
    const code = msg.substring(start, end);
    const img = getImg(escapeMsg(code), srcset);
    const newMsg = msg.substring(0, start) + img + msg.substring(end);
    return [ newMsg, img.length - code.length ];
};

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
            clearInterval(this._topicTimeoutId);
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
            clearInterval(this._listTimeoutId);
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
    _chattersAdding: false,
    _addChatters(chatters, skipCheck = false) {
        // Don't run this function again if we're still working on adding the last ones.
        if(this._chattersAdding)
            return;

        const workOnQueue = (i, category, interval) => {
            this._chattersAdding = true;
            const participants = [];
            const goalIndex = Math.min(i + interval, chatters[category].length);
            let hadParticipant = true;
            let pa;
            while(i < goalIndex) {
                if(skipCheck)
                    hadParticipant = this._hasParticipant(chatters[category][i]);

                pa = this.getParticipant(chatters[category][i], !skipCheck, skipCheck);
                if(category === "moderators")
                    pa.addBadge(this._getConversationBadge("mod"));
                else if(category === "staff")
                    pa.addBadge("staff");
                else if(category === "global_mods")
                    pa.addBadge("global_mod");
                else if(category === "admins")
                    pa.addBadge("admin");

                if(skipCheck && !hadParticipant)
                    participants.push(pa);

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

            if(i < chatters[category].length)
                setTimeout(workOnQueue.bind(null, i, category, interval), 0);
            else
                this._chattersAdding = false;
        };

        for(let category in chatters) {
            if(category !== "viewers" || (skipCheck && p.prefs.show_all_chatter)) {
                workOnQueue(0, category, skipCheck ? p.prefs.participants_adding_batch_size : chatters[category].length);
            }
        }

        if(this._isFilled) {
            let remove = false;
            this._participants.forEach((p, n) => {
                if(!p.halfOp && !chatters.viewers.includes(n) && n != this.normalizeNick(this._account.name))
                    this.removeParticipant(p.name);
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
    getParticipant: function(who, notifyObservers = false, noBotCheck = false) {
        if(this._participants.has(who)) {
            const participant = this._participants.get(who);
            if(who !== this.normalizeNick(who) && participant.name !== who)
                this.updateNick(participant.name, who);
            return participant;
        }

        if(BUILTINS.includes(who))
            return;

        let participant = new Participant(who, this, null, noBotCheck);
        this._participants.set(who, participant);

        this._account.setWhois(participant.name, {
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

        obj.containsNick = obj.incoming && this._pingRegexp.test(msg);

        GenericConvChatPrototype.writeMessage.call(this, who, msg, obj);
    },
    prepareForDisplaying: function(msg) {
        if(msg.system) {
            msg.displayMessage = escapeMsg(msg.displayMessage);
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
                if(replacedLength >= initialLength)
                    break;
            }
        }
        else {
            const meta = this.getParticipant(msg.who);
            if(meta._color)
                msg.color = meta._color;

            if(Array.isArray(meta._emotes) && meta._emotes.length > 0 && meta._emotes[0].length > 0) {
                let emotes = [];
                meta._emotes.forEach((emote) => {
                    let [id, ...occurences] = emote.split(/[-:,]/);

                    for(let i = 0; i < occurences.length - 1; i += 2) {
                        emotes.push({
                            id,
                            start: parseInt(occurences[i], 10),
                            end: parseInt(occurences[i + 1], 10) + 1
                        });
                    }
                });

                emotes.sort((a, b) => Math.sign(a.start - b.start));

                let compensation = msg.displayMessage.indexOf(ACTION_START) == 0 ? ACTION_START.length : 0;

                emotes.forEach((e, i) => {
                    const [ displayMessage, difference ] = replaceCharacters(msg.displayMessage, e.start + compensation, e.end + compensation, getTwitchSrcset(e.id));

                    if(i == 0) {
                        msg.displayMessage = escapeMsg(displayMessage.substring(0, e.start + compensation)) + displayMessage.substring(e.start + compensation);
                    }
                    else if(i > 0) {
                        const prev = emotes[i -1];
                        msg.displayMessage = displayMessage.substring(0, prev.end + compensation) + escapeMsg(displayMessage.substring(prev.end + compensation, e.start + compensation)) + displayMessage.substring(e.start + compensation);
                    }
                    compensation += difference;

                    if(i == emotes.length - 1) {
                        msg.displayMessage = msg.displayMessage.substring(0, e.end + compensation) + escapeMsg(msg.displayMessage.substring(e.end + compensation));
                    }
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
