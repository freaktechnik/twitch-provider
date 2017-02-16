/* eslint-disable camelcase */
/**
 * Twitch specific IRC handlers
 * @author Martin Giger
 * @license MIT
 * @module lib/twitch/handlers
 */
"use strict";

const { ircHandlers } = require("resource:///modules/ircHandlers.jsm");
const { ircBase } = require("resource:///modules/ircBase.jsm");
const { ircCAP } = require("resource:///modules/ircCAP.jsm");
const { ircCTCP } = require("resource:///modules/ircCTCP.jsm");

const { get: _ } = require("sdk/l10n");
const { when } = require("sdk/system/unload");
const self = require("sdk/self");

const twitchAPI = require("./api");
const { ID } = require("./const");
const { StringBundle } = require("../string-bundle");
const { getBadge } = require("./badge");

const { escapeMsg } = require("../escape");
const emoteHelper = require("../emote-helpers");

const SUPPORTED_MSG_IDS = [ "subs_on", "subs_off", "slow_on", "slow_off", "r9k_on", "r9k_off", "host_on", "host_off", "timeout_success", "ban_success", "cmds_available", "emote_only_on", "emote_only_off", "followers_off", "followers_on", "followers_on_zero" ];
const IGNORED_MSG_IDS = [ "room_mods" ];
const ACTION_START = "/me ";

const langbundle = new StringBundle("chrome://global/locale/languageNames.properties");
const regbundle = new StringBundle("chrome://global/locale/regionNames.properties");

const lookupMap = new Map();
const getColor = (hex) => {
    if(!hex.length) {
        return null;
    }

    if(hex[0] == "#") {
        hex = hex.substr(1);
    }

    if(lookupMap.has(hex)) {
        return lookupMap.get(hex);
    }

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    if(d <= Number.EPSILON) {
        return null;
    }
    else if(max == r) {
        h = (g - b) / d + (g < b ? 6 : 0);
    }
    else if(max == g) {
        h = (b - r) / d + 2;
    }
    else {
        h = (r - g) / d + 4;
    }

    lookupMap.set(hex, Math.round(h / 6 * 360));
    return lookupMap.get(hex);
};

function getBadges(msg, account) {
    if(msg.tags.get("subscriber") == "1") {
        account.addBadge(getBadge("sub", msg.params[0]));
    }
    else if(account.hasBadge(getBadge("sub", msg.params[0]))) {
        account.removeBadge(getBadge("sub", msg.params[0]));
    }
    if(msg.tags.get("turbo") == "1") {
        account.addBadge("turbo");
    }
    else if(account.hasBadge("turbo")) {
        account.removeBadge("turbo");
    }
    if(msg.tags.get("mod") == "1") {
        account.addBadge(getBadge("mod", msg.params[0]));
    }
    else if(account.hasBadge(getBadge("mod", msg.params[0]))) {
        account.removeBadge(getBadge("mod", msg.params[0]));
    }
    if(msg.tags.get("user-type") && msg.tags.get("user-type") !== "mod") {
        account.addBadge(msg.tags.get("user-type"));
    }

    if(msg.tags.get("user-type") !== "staff" && account.hasBadge("staff")) {
        account.removeBadge("staff");
    }
    else if(msg.tags.get("user-type") !== "admin" && account.hasBadge("admin")) {
        account.removeBadge("admin");
    }
    else if(msg.tags.get("user-type") !== "global_mod" && account.hasBadge("global_mod")) {
        account.removeBadge("global_mod");
    }

    if(msg.tags.get("badges").includes("premium")) {
        account.addBadge("premium");
    }
}

function checkAccount() {
    return this.protocol.id === ID; // eslint-disable-line no-invalid-this
}

// 0 is the first word, 1 is the last word, 2 is channel name
//TODO slowmode cooldown calc
const ARGUMENT_MAP = {
    hosts_remaining: 0,
    unban_success: 0,
    untimeout_success: 0,
    bad_unban_no_ban: 0,
    already_banned: 0,
    unrecognized_cmd: 1,
    msg_subonly: 2
};

function getArguments(message) {
    const args = [];

    if(message.tags.get("msg-id") in ARGUMENT_MAP) {
        const argtype = ARGUMENT_MAP[message.tags.get("msg-id")];
        if(argtype === 0) {
            args.push(message.params[1].split(" ").shift());
        }
        else if(argtype == 1) {
            args.push(message.params[1].split(" ").pop());
        }
        else if(argtype == 2) {
            args.push(message.params[0].substr(1));
        }
    }

    return args;
}

const ctcpHandlers = {
    name: "Twitch CTCP",
    priority: ircHandlers.HIGH_PRIORITY,
    isEnabled: checkAccount,
    commands: {
        "ACTION"(message) {
            const params = {
                incoming: true,
                tags: message.tags
            };
            const displayName = message.tags.get("display-name") || message.tags.get("login") || message.origin;

            this.getConversation(message.params[0]).writeMessage(displayName, "/me " + message.ctcp.param, params);

            return true;
        }
    }
};

const handlers = {
    name: "Twitch",
    priority: ircHandlers.HIGH_PRIORITY,
    isEnabled: checkAccount,
    commands: {
        NOTICE(message) {
            if(message.params[0].charAt(0) == "#") {
                const conversation = this.getConversation(message.params[0]);

                // Filter notices we display via ROOMSTATE and HOSTTARGET
                if(!message.tags.has("msg-id")) {
                    conversation.writeMessage(message.origin, message.params[1], { system: true, tags: message.tags });
                }
                else if(!SUPPORTED_MSG_IDS.includes(message.tags.get("msg-id")) && !IGNORED_MSG_IDS.includes(message.tags.get("msg-id"))) {
                    //TODO get arguments
                    conversation.writeMessage(message.origin, _(message.tags.get("msg-id"), ...getArguments(message)), { system: true, tags: message.tags });
                }

                return true;
            }
            return false;
        },
        ROOMSTATE(message) {
            const text = [];

            if(message.tags.has("r9k")) {
                if(message.tags.get("r9k") != "0") {
                    text.push(_("r9k_on"));
                }
                else if(message.tags.size == 1) {
                    text.push(_("r9k_off"));
                }
            }
            if(message.tags.has("slow")) {
                if(message.tags.get("slow") != "0") {
                    text.push(_("slow_on", message.tags.get("slow")));
                }
                else if(message.tags.size == 1) {
                    text.push(_("slow_off"));
                }
            }
            if(message.tags.has("subs-only")) {
                if(message.tags.get("subs-only") != "0") {
                    text.push(_("subs_on"));
                }
                else if(message.tags.size == 1) {
                    text.push(_("subs_off"));
                }
            }
            if(message.tags.has("emote-only")) {
                if(message.tags.get("emote-only") != "0") {
                    text.push(_("emote_only_on"));
                }
                else if(message.tags.size == 1) {
                    text.push(_("emote_only_off"));
                }
            }
            if(message.tags.has("followers-only")) {
                if(message.tags.get("followers-only") == "-1") {
                    text.push(_("followers_only_off"));
                }
                else if(message.tags.get("followers-only") == "0") {
                    text.push(_("followers_only_zero"));
                }
                else {
                    text.push(_("followers_only_on", message.tags.get("followers-only")));
                }
            }
            if(message.tags.has("broadcaster-lang")) {
                const conversation = this.getConversation(message.params[0]);
                if(message.tags.get("broadcaster-lang") &&
                   message.tags.get("broadcaster-lang") != conversation.broadcasterLanguage) {
                    const [ lang, reg ] = message.tags.get("broadcaster-lang").toLowerCase().split("-");
                    let msg;
                    try {
                        let langName = langbundle.get(lang);
                        if(reg) {
                            langName = _("language_region", langName, regbundle.get(reg));
                        }
                        msg = _("broadcaster_lang", langName);
                    }
                    catch(e) {
                        msg = _("broadcaster_lang", message.tags.get("broadcaster-lang"));
                    }
                    finally {
                        text.push(msg);
                    }
                }
                conversation.broadcasterLanguage = message.tags.get("broadcaster-lang");
            }

            if(text.length) {
                const conversation = this.getConversation(message.params[0]);
                text.forEach((t) => conversation.writeMessage(message.origin, t, { system: true, tags: message.tags }));
            }

            return true;
        },
        USERSTATE(message) {
            this._color = getColor(message.tags.get("color"));

            if(this._nickname !== message.tags.get("display-name")) {
                this._changeBuddyNick(this._nickname, message.tags.get("display-name"));
            }

            if(this._currentEmoteSets != message.tags.get("emote-sets")) {
                twitchAPI.getEmoteSets(message.tags.get("emote-sets")).then((emotes) => {
                    this._emotes = emotes;
                    this._currentEmoteSets = message.tags.get("emote-sets");
                });
            }

            getBadges(message, this);

            return true;
        },
        GLOBALUSERSTATE(message) {
            return handlers.commands.USERSTATE.call(this, message);
        },
        CLEARCHAT(message) {
            if(message.params.length > 1) { // messages of a user have been cleared
                const conversation = this.getConversation(message.params[0]);
                const participant = conversation.getParticipant(message.params[1], true) || {
                    name: message.params[1]
                };

                // Check the status of the participant to avoid showing multiple bans.
                if(participant.name == this.name || !participant.banned) {
                    let msgtext;
                    if(message.tags.has("ban-reason") && message.tags.get("ban-reason").length) {
                        if(message.tags.has("ban-duration")) {
                            msgtext = _("timeout_user", participant.name, message.tags.get("ban-duration"), message.tags.get("ban-reason"));
                        }
                        else {
                            msgtext = _("ban_user", participant.name, message.tags.get("ban-reason"));
                        }
                    }
                    else {
                        if(message.tags.has("ban-duration")) {
                            msgtext = _("timeout_success", participant.name, message.tags.get("ban-duration"));
                        }
                        else {
                            msgtext = _("ban_success", participant.name);
                        }
                    }

                    if(participant.name != this.name) {
                        participant.banned = true;
                    }

                    conversation.writeMessage(message.origin, msgtext, { system: true, tags: message.tags });
                    //TODO do fancy strikethrough on past messages of that user?
                }
            }
            else {
                const conversation = this.getConversation(message.params[0]);
                conversation.writeMessage(message.origin, _("chat_cleared"), { system: true, tags: message.tags });
            }
            return true;
        },
        HOSTTARGET(message) {
            let text = _("host_off");
            if(message.params[1].charAt(0) != "-") {
                text = _("host_on", message.params[1].split(" ")[0]);
            }

            const conversation = this.getConversation(message.params[0]);
            conversation.writeMessage(message.origin, text, { system: true, tags: message.tags });

            return true;
        },
        PRIVMSG(message) {
            if(ircCTCP.commands.PRIVMSG.call(this, message)) {
                return true;
            }

            const params = { tags: message.tags };

            if(message.origin == this.normalizeNick(this._nickname)) {
                params.outgoing = true;
            }
            else {
                params.incoming = true;
            }

            const displayName = message.tags.get("display-name") || message.tags.get("login") || message.origin;

            if(message.origin == "twitchnotify" || message.origin == "jtv") { // subscription notifications and such shit
                params.system = true;
            }
            else {
                const participant = this.getConversation(message.params[0]).getParticipant(displayName, true);
                getBadges(message, participant);

                if(participant.name != this.name) {
                    participant.banned = false;
                }
            }

            // this breaks private /msgs, which twitch doesn't seem to be using
            this.getConversation(message.params[0]).writeMessage(displayName, message.params[1], params);

            return true;
        },
        WHISPER(message) {
            const params = { incoming: true, tags: message.tags };
            const displayName = message.tags.get("display-name") || message.tags.get("login") || message.origin;

            this.getConversation(displayName).writeMessage(displayName, message.params[1], params);
            return true;
        },
        JOIN(message) {
            message.params[0].split(",").forEach((channelName) => {
                const conversation = this.getConversation(channelName);

                if(this.normalizeNick(message.origin) === this.normalizeNick(this._nickname)) {
                    conversation.removeAllParticipants();
                    conversation.left = false;
                    conversation.joining = false;

                    // Ensure chatRoomFields information is available for reconnection.
                    if(!conversation.chatRoomFields) {
                        this.WARN("Opening a MUC without storing its " +
                                  "prplIChatRoomFieldValues first.");
                        conversation.chatRoomFields =
                            this.getChatRoomDefaultFieldValues(channelName);
                    }
                }
                else {
                    conversation.getParticipant(message.origin, true);
                }
            });
            return true;
        },
        PART(message) {
            message.params[0].split(",").forEach((channelName) => {
                if(this.conversations.has(channelName)) {
                    const conversation = this.getConversation(channelName);

                    if(conversation._participants.has(message.origin)) {
                        if(this.normalizeNick(message.origin) === this.normalizeNick(this._nickname)) {
                            conversation.left = true;
                        }

                        conversation.removeParticipant(conversation.getParticipant(message.origin).name);
                    }
                }
            });
            return true;
        },
        USERNOTICE(message) {
            const conversation = this.getConversation(message.params[0]);
            const displayName = message.tags.get("display-name") || message.tags.get("login") || message.origin;

            conversation.writeMessage(message.origin, _("resub", displayName, message.tags.get("msg-param-months")), { system: true, tags: message.tags });
            if(message.params.length > 1) {
                const params = { incoming: true, tags: message.tags };
                const participant = this.getConversation(message.params[0]).getParticipant(displayName, true);
                getBadges(message, participant);
                conversation.writeMessage(displayName, message.params[1], params);
            }
            return true;
        },
        SERVERCHANGE() {
            // No longer happens.
            return true;
        },
        RECONNECT() {
            // Not sure how to handle that.
            return true;
        }
    }
};

const capHandlers = {
    name: "Twitch CAP handlers",
    priority: ircHandlers.HIGH_PRIORITY,
    isEnabled: () => true,
    commands: {
        "twitch.tv/membership"(message) {
            if(message.cap.subcommand == "LS") {
                // get users in channels
                this.sendMessage("CAP", [ "REQ", "twitch.tv/membership" ]);
            }
            return true;
        },
        "twitch.tv/commands"(message) {
            if(message.cap.subcommand == "LS") {
                // enable state infos
                this.sendMessage("CAP", [ "REQ", "twitch.tv/commands" ]);
            }
            return true;
        },
        "twitch.tv/tags"(message) {
            if(message.cap.subcommand == "LS") {
                // get tags with user infos
                this.sendMessage("CAP", [ "REQ", "twitch.tv/tags" ]);
            }
            return true;
        }
    }
};

const twitchIrcBaseHandlers = {
    name: "Twitch IRC base handlers",
    isEnabled: checkAccount,
    propertiy: ircHandlers.HIGH_PRIORITY,
    commands: ircBase.commands
};

const twitchIrcCAPHandlers = {
    name: "Twitch IRC CAP handlers",
    isEnabled: checkAccount,
    propertiy: ircHandlers.HIGH_PRIORITY,
    commands: ircCAP.commands
};

//TODO make badges, display-name and login a tag handler
const tagHandlers = {
    name: "Twitch CTCP",
    priority: ircHandlers.HIGH_PRIORITY,
    isEnabled: checkAccount,
    commands: {
        color(tagMsg) {
            tagMsg.message.color = tagMsg.tagValue;
        },
        emotes(tagMsg) {
            const emotesTag = tagMsg.tagValue.split("/");

            if(Array.isArray(emotesTag) && emotesTag.length > 0 && emotesTag[0].length > 0) {
                const emotes = [];
                emotesTag.forEach((emote) => {
                    const [ id, ...occurences ] = emote.split(/[-:,]/);

                    for(let i = 0; i < occurences.length - 1; i += 2) {
                        emotes.push({
                            id,
                            start: parseInt(occurences[i], 10),
                            end: parseInt(occurences[i + 1], 10) + 1
                        });
                    }
                });

                emotes.sort((a, b) => Math.sign(a.start - b.start));

                let compensation = tagMsg.message.displayMessage.indexOf(ACTION_START) == 0 ? ACTION_START.length : 0;

                emotes.forEach((e, i) => {
                    const [ displayMessage, difference ] = emoteHelper.replaceCharacters(tagMsg.message.displayMessage, e.start + compensation, e.end + compensation, emoteHelper.getTwitchSrcset(e.id));

                    if(i == 0) {
                        tagMsg.message.displayMessage = escapeMsg(displayMessage.substring(0, e.start + compensation)) + displayMessage.substring(e.start + compensation);
                    }
                    else if(i > 0) {
                        const prev = emotes[i - 1];
                        tagMsg.message.displayMessage = displayMessage.substring(0, prev.end + compensation) + escapeMsg(displayMessage.substring(prev.end + compensation, e.start + compensation)) + displayMessage.substring(e.start + compensation);
                    }
                    compensation += difference;

                    if(i == emotes.length - 1) {
                        tagMsg.message.displayMessage = tagMsg.message.displayMessage.substring(0, e.end + compensation) + escapeMsg(tagMsg.message.displayMessage.substring(e.end + compensation));
                    }
                });
                tagMsg.message.escaped = true;
            }
        },
        historical(tagMsg) {
            if(tagMsg.tagValue == "1") {
                tagMsg.message.delayed = true;
                tagMsg.message.time = Math.floor(parseInt(tagMsg.message.tags.get("tmi-sent-ts"), 10) / 1000);
            }
        }
    }
};

if(self.loadReason == "upgrade" || self.loadReason == "downgrade") {
    const filter = (h) => {
        try {
            if(h.name.includes("Twitch")) {
                return false;
            }
        }
        catch(e) {
            return false;
        }
        return true;
    };
    ircHandlers._ircHandlers = ircHandlers._ircHandlers.filter(filter);
    ircHandlers._capHandlers = ircHandlers._capHandlers.filter(filter);
    ircHandlers._ctcpHandlers = ircHandlers._ctcpHandlers.filter(filter);
    ircHandlers._tagHandlers = ircHandlers._tagHandlers.filter(filter);
}

let registered = false;
exports.registerHandlers = () => {
    if(!registered) {
        ircHandlers.registerHandler(handlers);
        ircHandlers.registerCTCPHandler(ctcpHandlers);
        ircHandlers.registerCAPHandler(capHandlers);
        ircHandlers.registerTagHandler(tagHandlers);

        // Make sure the default IRC protocol handlers are registered.
        // These are twitch prpl specific clones of the base handlers.
        ircHandlers.registerHandler(twitchIrcBaseHandlers);
        ircHandlers.registerHandler(twitchIrcCAPHandlers);

        when(() => {
            ircHandlers.unregisterHandler(handlers);
            ircHandlers.unregisterCTCPHandler(ctcpHandlers);
            ircHandlers.unregisterCAPHandler(capHandlers);
            ircHandlers.unregisterTagHandler(tagHandlers);
            ircHandlers.unregisterHandler(twitchIrcBaseHandlers);
            ircHandlers.unregisterHandler(twitchIrcCAPHandlers);
        });

        registered = true;
    }
};
