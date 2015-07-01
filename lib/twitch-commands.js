/*
 * Twitch IRC commands
 * This is only a subset of all IRC commands.
 */

//TODO l10n

const { commands } = require("resource:///modules/ircCommands.jsm");

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
        get helpString() "/join #<channel name>",
        run: getIRCCommandAction("join")
    },
    {
        name: "part",
        get helpString() "/part",
        run: getIRCCommandAction("part")
    },
    {
        name: "me",
        get helpString() "/me <message>",
        run: getIRCCommandAction("me")
    },
    {
        name: "quit",
        get helpString() "/quit",
        run: getIRCCommandAction("quit")
    },
    {
        name: "mods",
        get helpString() "/mods",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "color",
        get helpString() "/color <color>",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "ban",
        get helpString() "/ban <username>",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unban",
        get helpString() "/unban <username>",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "clear",
        get helpString() "/clear",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "timeout",
        get helpString() "/timeout <username> [duration]",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "subscribers",
        get helpString() "/subscribers",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "subscribersoff",
        get helpString() "/subscribersoff",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "slow",
        get helpString() "/slow",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "slowoff",
        get helpString() "/slowoff",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "r9kbeta",
        get helpString() "/r9kbeta",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "r9kbetaoff",
        get helpString() "/r9kbetaoff",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "host",
        get helpString() "/host <channel>",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unhost",
        get helpString() "/unhost",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "mod",
        get helpString() "/mod <username>",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unmod",
        get helpString() "/unmod <username>",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "commercial",
        get helpString() "/commercial [length]",
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    }
];
