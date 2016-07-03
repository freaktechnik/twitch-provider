/*
 * Twitch IRC commands
 * This is only a subset of all IRC commands.
 */

const { commands } = require("resource:///modules/ircCommands.jsm");

const { get: _ } = require("sdk/l10n");
const L10N_PREFIX = "usage_";

let getConv = (conv) => conv.wrappedJSObject;
let getAccount = (conv) => getConv(conv)._account;

let getIRCCommandAction = (name) => {
    return commands.find((c) => c.name == name).run;
};

let remoteTwitchCommand = (name, args, conv) => {
    getConv(conv).sendMsg("." + name + " " + args);

    return true;
}

exports.commands = [
    {
        name: "join",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return getIRCCommandAction("join")(msg.toLowerCase(), conv, retConv);
        }
    },
    {
        name: "part",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run: getIRCCommandAction("part")
    },
    {
        name: "me",
        get helpString() {
            return _(L10N_PREFIX+this.name)
        },
        run: getIRCCommandAction("me")
    },
    {
        name: "quit",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run: getIRCCommandAction("quit")
    },
    {
        name: "mods",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "color",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "ban",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unban",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "clear",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "timeout",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "subscribers",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "subscribersoff",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "slow",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "slowoff",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "r9kbeta",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "r9kbetaoff",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "host",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unhost",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "mod",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            const c = getConv(conv);
            if(c.getParticipant(getAccount(conv).name).halfOp)
                c.getParticipant(msg).addBadge(c._getConversationBadge("mod"));
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unmod",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            const c = getConv(conv);
            if(c.getParticipant(getAccount(conv).name).halfOp)
                c.getParticipant(msg).removeBadge(c._getConversationBadge("mod"));
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "commercial",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "emoteonly",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "emoteonlyoff",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "cheerbadge",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        }
        run(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "w",
        get helpString() {
            return _(L10N_PREFIX+this.name);
        },
        run(msg, conv, retConv) {
            let [ nick, ...message ] = msg.split(" ");
            msg = message.join(" ");
            getAccount(conv).getConversation(nick).sendMsg(msg);
            return true;
        }
    }
];
