/*
 * Twitch specific IRC handlers
 */

const { ircHandlers } = require("resource:///modules/ircHandlers.jsm");

const _ = require("sdk/l10n").get;

const supportedMsgIds = [ "subs_on", "subs_off", "slow_on", "slow_off", "r9k_on", "r9k_off", "host_on", "host_off" ];

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

exports.handlers = {
    name: "Twitch",
    priority: ircHandlers.HIGH_PRIORITY,
    isEnabled: () => true,
    commands: {
        "NOTICE": function(message) {
            if(message.params[0].charAt(0) == "#") {
                let conversation = this.getConversation(message.params[0]);

                // Filter notices we display via ROOMSTATE and HOSTTARGET
                if(supportedMsgIds.indexOf(message.tags.get("msg-id")) == -1)
                    conversation.writeMessage(message.origin, message.params[1], {system: true});

                return true;
            }
            return false;
        },
        "ROOMSTATE": function(message) {
            let text = "";

            if(message.tags.get("r9k") != "0")
                text = _("r9k_on");
            else if(message.tags.size == 1)
                text = _("r9k_off");

            if(message.tags.get("slow") != "0")
                text = _("slow_on", message.tags.get("slow"));
            else if(message.tags.size == 1)
                text = _("slow_off");

            if(message.tags.get("subs-only") != "0")
                text = _("subs_on");
            else if(message.tags.size == 1)
                text = _("subs_off");

            if(text) {
                let conversation = this.getConversation(message.params[0]);
                conversation.writeMessage(message.origin, text, {system: true});
            }

            return !!text;
        },
        "USERSTATE": function(message) {
            this._color = message.tags.get("color");
            this._nickname = message.tags.get("display-name");
            this._emotes = message.tags.get("emote-sets").split(",");

            getBadges(message, this);

            return true;
        },
        "CLEARCHAT": function(message) {
            if(message.params.length > 1) { // messages of a user have been cleared
                let conversation = this.getConversation(message.params[0]);
                conversation.writeMessage(message.origin, _("clear_user",message.prams[1].slice(1)), {system: true});
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
            let params = { incoming: true, color: message.tags.get("color"), emotes: message.tags.get("emotes").split("/") };
            // this breaks private /msgs, which twitch doesn't seem to be using
            this.getConversation(message.params[0]).writeMessage(message.tags.get("display-name"), message.params[1], params);

            return true;
        }
    }
};