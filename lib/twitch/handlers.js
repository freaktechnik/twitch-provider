/*
 * Twitch specific IRC handlers
 */
//TODO make sure these only return true for twitch.

const { ircHandlers } = require("resource:///modules/ircHandlers.jsm");

const { get: _ } = require("sdk/l10n");

const twitchAPI = require("./api");
const { StringBundle } = require("../string-bundle");


const supportedMsgIds = [ "subs_on", "subs_off", "slow_on", "slow_off", "r9k_on", "r9k_off", "host_on", "host_off" ];

const langbundle = new StringBundle("chrome://global/locale/languageNames.properties");
const regbundle = new StringBundle("chrome://global/locale/regionNames.properties");

const BADGE_CHANNEL_SPLITTER = ":";
function getBadges(msg, account) {
    let ret = [];

    if(msg.tags.get("subscriber") == "1")
        ret.push("sub" + BADGE_CHANNEL_SPLITTER + msg.params[0]);
    if(msg.tags.get("turbo") == "1")
        ret.push("turbo");
    if(msg.tags.get("user-type")) {
        if(msg.tags.get("user-type") == "mod")
            ret.push(msg.tags.get("user-type") + BADGE_CHANNEL_SPLITTER + msg.params[0]);
        else
            ret.push(msg.tags.get("user-type"));
    }

    ret.forEach((badge) => {
        if(account._badges.indexOf(badge) == -1)
            account._badges.push(badge);
    });
}

function checkAccount() {
    return this.protocol.name === _("twitch_name");
}

exports.ctcpHandlers = {
    name: "Twitch CTCP",
    priority: ircHandlers.HIGH_PRIORITY,
    isEnabled: checkAccount,
    commands: {
       "ACTION": function(message) {
            let params = { incoming: true, color: message.tags.get("color"), emotes: message.tags.get("emotes").split("/") };
            let displayName = message.tags.get("display-name") || message.origin;

            this.getConversation(message.params[0]).writeMessage(displayName, "/me " + message.ctcp.param, params);

            return true;
        }
    }
};

exports.handlers = {
    name: "Twitch",
    priority: ircHandlers.HIGH_PRIORITY,
    isEnabled: checkAccount,
    commands: {
        "NOTICE": function(message) {
            if(message.params[0].charAt(0) == "#") {
                let conversation = this.getConversation(message.params[0]);

                // Filter notices we display via ROOMSTATE and HOSTTARGET
                if(!message.tags.has("msg-id") || supportedMsgIds.indexOf(message.tags.get("msg-id")) == -1)
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
            if(message.tags.has("broadcaster-lang") && message.tags.get("broadcaster-lang")) {
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

            if(text.length) {
                let conversation = this.getConversation(message.params[0]);
                text.forEach((t) => conversation.writeMessage(message.origin, t, {system: true}));
            }

            return true;
        },
        "USERSTATE": function(message) {
            this._color = message.tags.get("color");

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
            let params = { incoming: true };
            if(message.origin == "twitchnotify" || message.origin == "jtv") { // subscription notifications and such shit
                params.system = true;
            }
            else {
                 params.color = message.tags.get("color");
                 params.emotes = message.tags.get("emotes").split("/");
            }
            let displayName = message.tags.get("display-name") || message.origin;

            // this breaks private /msgs, which twitch doesn't seem to be using
            this.getConversation(message.params[0]).writeMessage(displayName, message.params[1], params);

            return true;
        },
        "WHISPER": function(message) {
            let params = { incoming: true };
            params.color = message.tags.get("color");
            params.emotes = message.tags.get("emotes").split("/");
            let displayName = message.tags.get("display-name") || message.origin;

            this.getConversation(message.params[0]).writeMessage(displayName, message.params[1], params);
            return true;
        }
    }
};

exports.capHandlers = {
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
        }
    }
};
