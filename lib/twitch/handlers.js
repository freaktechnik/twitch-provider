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

const SUPPORTED_MSG_IDS = [ "subs_on", "subs_off", "slow_on", "slow_off", "r9k_on", "r9k_off", "host_on", "host_off" ];

const langbundle = new StringBundle("chrome://global/locale/languageNames.properties");
const regbundle = new StringBundle("chrome://global/locale/regionNames.properties");

const lookupMap = new Map();
const getColor = (hex) => {
    if(!hex.length)
        return null;

    if(hex[0] == "#")
        hex = hex.substr(1);

    if(lookupMap.has(hex))
        return lookupMap.get(hex);

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    if(d <= Number.EPSILON)
        return null;
    else if(max == r)
        h = (g - b) / d + (g < b ? 6 : 0);
    else if(max == g)
        h = (b - r) / d + 2;
    else
        h = (r - g) / d + 4;

    lookupMap.set(hex, Math.round(h / 6 * 360));
    return lookupMap.get(hex);
};

function getBadges(msg, account) {
    if(msg.tags.get("subscriber") == "1")
        account.addBadge(getBadge("sub", msg.params[0]));
    else if(account.hasBadge(getBadge("sub", msg.params[0])))
        account.removeBadge(getBadge("sub", msg.params[0]));
    if(msg.tags.get("turbo") == "1")
        account.addBadge("turbo");
    else if(account.hasBadge("turbo"))
        account.removeBadge("turbo");
    if(msg.tags.get("mod") == "1")
        account.addBadge(getBadge("sub", msg.params[0]));
    else if(account.hasBadge(getBadge("sub", msg.params[0])))
        account.removeBadge(getBadge("sub", msg.params[0]));
    if(msg.tags.get("user-type") & msg.tags.get("user-type") !== "mod")
        account.addBadge(msg.tags.get("user-type"));

    if(msg.tags.get("user-type") !== "staff" && account.hasBadge("staff"))
        account.removeBadge("staff");
    else if(msg.tags.get("user-type") !== "admin" && account.hasBadge("admin"))
        account.removeBadge("admin");
    else if(msg.tags.get("user-type") !== "global_mod" && account.hasBadge("global_mod"))
        account.removeBadge("global_mod");
}

function checkAccount() {
    return this.protocol.id === ID;
}

let ctcpHandlers = {
    name: "Twitch CTCP",
    priority: ircHandlers.HIGH_PRIORITY,
    isEnabled: checkAccount,
    commands: {
       "ACTION": function(message) {
            let params = { incoming: true, color: getColor(message.tags.get("color")), emotes: message.tags.get("emotes").split("/") };
            let displayName = message.tags.get("display-name") || message.origin;

            this.getConversation(message.params[0]).writeMessage(displayName, "/me " + message.ctcp.param, params);

            return true;
        }
    }
};

let handlers = {
    name: "Twitch",
    priority: ircHandlers.HIGH_PRIORITY,
    isEnabled: checkAccount,
    commands: {
        "NOTICE": function(message) {
            if(message.params[0].charAt(0) == "#") {
                let conversation = this.getConversation(message.params[0]);

                // Filter notices we display via ROOMSTATE and HOSTTARGET
                if(!message.tags.has("msg-id") || !SUPPORTED_MSG_IDS.includes(message.tags.get("msg-id")))
                    conversation.writeMessage(message.origin, message.params[1], {system: true});

                return true;
            }
            return false;
        },
        "ROOMSTATE": function(message) {
            let text = [];

            if(message.tags.has("r9k")) {
                if(message.tags.get("r9k") != "0")
                    text.push(_("r9k_on"));
                else if(message.tags.size == 1)
                    text.push(_("r9k_off"));
            }
            if(message.tags.has("slow")) {
                if(message.tags.get("slow") != "0")
                    text.push(_("slow_on", message.tags.get("slow")));
                else if(message.tags.size == 1)
                    text.push(_("slow_off"));
            }
            if(message.tags.has("subs-only")) {
                if(message.tags.get("subs-only") != "0")
                    text.push(_("subs_on"));
                else if(message.tags.size == 1)
                    text.push(_("subs_off"));
            }
            if(message.tags.has("broadcaster-lang")) {
                let conversation = this.getConversation(message.params[0]);
                if(message.tags.get("broadcaster-lang") &&
                   message.tags.get("broadcaster-lang") != conversation.broadcasterLanguage) {
                    let [ lang, reg ] = message.tags.get("broadcaster-lang").toLowerCase().split("-");
                    let msg;
                    try {
                        let langName = langbundle.get(lang);
                        if(reg) {
                            langName = _("language_region", langName, regbundle.get(reg));
                        }
                        msg = _("broadcaster_lang", langName);
                    } catch(e) {
                        msg = _("broadcaster_lang", message.tags.get("broadcaster-lang"));
                    } finally {
                        text.push(msg);
                    }
                }
                conversation.broadcasterLanguage = message.tags.get("broadcaster-lang");
            }

            if(text.length) {
                let conversation = this.getConversation(message.params[0]);
                text.forEach((t) => conversation.writeMessage(message.origin, t, {system: true}));
            }

            return true;
        },
        "USERSTATE": function(message) {
            this._color = getColor(message.tags.get("color"));

            if(this._nickname !== message.tags.get("display-name"))
                this._changeBuddyNick(this._nickname, message.tags.get("display-name"));

            if(this._currentEmoteSets != message.tags.get("emote-sets")) {
                twitchAPI.getEmoteSets(message.tags.get("emote-sets")).then((emotes) => {
                    this._emotes = emotes;
                    this._currentEmoteSets = message.tags.get("emote-sets");
                });
            }

            getBadges(message, this);

            return true;
        },
        "GLOBALUSERSTATE": function(message) {
            return handlers.commands.USERSTATE.call(this, message);
        },
        "CLEARCHAT": function(message) {
            if(message.params.length > 1) { // messages of a user have been cleared
                let conversation = this.getConversation(message.params[0]);
                conversation.writeMessage(message.origin, _("clear_user",message.params[1].slice(1)), {system: true});
                //TODO do fancy strikethrough on past messages of that user?
                return true;
            }
            // whole chat history has been cleared. Ignore that.
            return false;
        },
        "HOSTTARGET": function(message) {
            let text = _("host_off");
            if(message.params[1].charAt(0) != "-")
                text = _("host_on", message.params[1].split(" ")[0]);

            let conversation = this.getConversation(message.params[0]);
            conversation.writeMessage(message.origin, text, {system: true});

            return true;
        },
        "PRIVMSG": function(message) {
            if(ircCTCP.commands.PRIVMSG.call(this, message))
                return true;

            let params = {};

            if(message.origin == this.normalizeNick(this._nickname))
                params.outgoing = true;
            else
                params.incoming = true;

            let displayName = message.tags.get("display-name") || message.origin;

            if(message.origin == "twitchnotify" || message.origin == "jtv") { // subscription notifications and such shit
                params.system = true;
            }
            else {
                 params.color = getColor(message.tags.get("color"));
                 params.emotes = message.tags.get("emotes").split("/");
                 let participant = this.getConversation(message.params[0]).getParticipant(displayName, true);
                 getBadges(message, participant);
            }

            // this breaks private /msgs, which twitch doesn't seem to be using
            this.getConversation(message.params[0]).writeMessage(displayName, message.params[1], params);

            return true;
        },
        "WHISPER": function(message) {
            let params = { incoming: true };
            params.color = getColor(message.tags.get("color"));
            params.emotes = message.tags.get("emotes").split("/");
            let displayName = message.tags.get("display-name") || message.origin;

            this.getConversation(message.params[0]).writeMessage(displayName, message.params[1], params);
            return true;
        },
        "JOIN": function(message) {
            message.params[0].split(",").forEach((channelName) => {
                const conversation = this.getConversation(channelName);

                if(this.normalizeNick(message.origin) === this.normalizeNick(this._nickname)) {
                    conversation.removeAllParticipants();
                    conversation.left = false;
                    conversation.joining = false;

                    // Ensure chatRoomFields information is available for reconnection.
                    if (!conversation.chatRoomFields) {
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
        "PART": function(message) {
            message.params[0].split(",").forEach((channelName) => {
                if(this.conversations.has(channelName)) {
                    const conversation = this.getConversation(channelName);

                    if(this.normalizeNick(message.origin) === this.normalizeNick(this._nickname))
                        conversation.left = true;

                    conversation.removeParticipant(conversation.getParticipant(message.origin).name);
                }
            });
            return true;
        }
    }
};

let capHandlers = {
    name: "Twitch CAP handlers",
    priority: ircHandlers.HIGH_PRIORITY,
    isEnabled: () => true,
    commands: {
        "twitch.tv/membership": function(message) {
            if(message.cap.subcommand == "LS") {
                // get users in channels
                this.sendMessage("CAP", ["REQ", "twitch.tv/membership"]);
                this.addCAP("twitch.tv/membership");
            }
            return true;
        },
        "twitch.tv/commands": function(message) {
            if(message.cap.subcommand == "LS") {
                // enable state infos
                this.sendMessage("CAP", ["REQ", "twitch.tv/commands"]);
                this.addCAP("twitch.tv/commands");
            }
            return true;
        },
        "twitch.tv/tags": function(message) {
            if(message.cap.subcommand == "LS") {
                // get tags with user infos
                this.sendMessage("CAP", ["REQ", "twitch.tv/tags"]);
                this.addCAP("twitch.tv/tags");
            }
            return true;
        }
    }
};

let twitchIrcBaseHandlers = {
    name: "Twitch IRC base handlers",
    isEnabled: checkAccount,
    propertiy: ircHandlers.HIGH_PRIORITY,
    commands: ircBase.commands
};

let twitchIrcCAPHandlers = {
    name: "Twitch IRC CAP handlers",
    isEnabled: checkAccount,
    propertiy: ircHandlers.HIGH_PRIORITY,
    commands: ircCAP.commands
};

if(self.loadReason == "upgrade" || self.loadReason == "downgrade") {
    let filter = (h) => {
        try {
            if(h.name.includes("Twitch"))
                return false;
        } catch(e) {
            return false;
        }
        return true;
    };
    ircHandlers._ircHandlers = ircHandlers._ircHandlers.filter(filter);
    ircHandlers._capHandlers = ircHandlers._capHandlers.filter(filter);
    ircHandlers._ctcpHandlers = ircHandlers._ctcpHandlers.filter(filter);
}

let registered = false;
exports.registerHandlers = () => {
    if(!registered) {
        ircHandlers.registerHandler(handlers);
        ircHandlers.registerCTCPHandler(ctcpHandlers);
        ircHandlers.registerCAPHandler(capHandlers);

        // Make sure the default IRC protocol handlers are registered.
        // These are twitch prpl specific clones of the base handlers.
        ircHandlers.registerHandler(twitchIrcBaseHandlers);
        ircHandlers.registerHandler(twitchIrcCAPHandlers);

        when(() => {
            ircHandlers.unregisterHandler(handlers);
            ircHandlers.unregisterCTCPHandler(ctcpHandlers);
            ircHandlers.unregisterCAPHandler(capHandlers);
            ircHandlers.unregisterHandler(twitchIrcBaseHandlers);
            ircHandlers.unregisterHandler(twitchIrcCAPHandlers);
        });

        registered = true;
    }
};
