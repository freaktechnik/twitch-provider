/*
 * Twitch IRC commands
 * This is only a subset of all IRC commands.
 */
"use strict";

const { commands } = require("resource:///modules/ircCommands.jsm");

const { get: _ } = require("sdk/l10n");
const L10N_PREFIX = "usage_";

const getConv = (conv) => conv.wrappedJSObject;
const getAccount = (conv) => getConv(conv)._account;

const getIRCCommandAction = (name) => {
    return commands.find((c) => c.name == name).run;
};

const remoteTwitchCommand = (name, args, conv) => {
    getConv(conv).sendMsg("." + name + " " + args);

    return true;
};

exports.commands = [
    {
        name: "join",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv, retConv) {
            return getIRCCommandAction("join")(msg.toLowerCase(), conv, retConv);
        }
    },
    {
        name: "part",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run: getIRCCommandAction("part")
    },
    {
        name: "me",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run: getIRCCommandAction("me")
    },
    {
        name: "quit",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run: getIRCCommandAction("quit")
    },
    {
        name: "mods",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "color",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "ban",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unban",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "clear",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "timeout",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "subscribers",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "subscribersoff",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "slow",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "slowoff",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "r9kbeta",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "r9kbetaoff",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "host",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unhost",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "mod",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            const c = getConv(conv);
            if(c.getParticipant(getAccount(conv).name).halfOp) {
                c.getParticipant(msg).addBadge(c._getConversationBadge("mod"));
            }
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unmod",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            const c = getConv(conv);
            if(c.getParticipant(getAccount(conv).name).halfOp) {
                c.getParticipant(msg).removeBadge(c._getConversationBadge("mod"));
            }
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "commercial",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "emoteonly",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "emoteonlyoff",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "cheerbadge",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "w",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            const [ nick, ...message ] = msg.split(" ");
            msg = message.join(" ");
            getAccount(conv).getConversation(nick).sendMsg(msg);
            return true;
        }
    },
    {
        name: "followers",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "followersoff",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "raid",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conf) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unraid",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conf) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "delete",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conf) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    //TODO these may not work
    {
        name: "vips",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conf) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unvip",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conf) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "vip",
        get helpString() {
            return _(L10N_PREFIX + this.name);
        },
        run(msg, conf) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    }
];
