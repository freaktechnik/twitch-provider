/*
 * Twitch IRC commands
 * This is only a subset of all IRC commands.
 */

const { commands } = require("resource:///modules/ircCommands.jsm");

const { get: _ } = require("sdk/l10n");

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
        get helpString() _("command_"+this.name),
        run: getIRCCommandAction("join")
    },
    {
        name: "part",
        get helpString() _("command_"+this.name),
        run: getIRCCommandAction("part")
    },
    {
        name: "me",
        get helpString() _("command_"+this.name),
        run: getIRCCommandAction("me")
    },
    {
        name: "quit",
        get helpString() _("command_"+this.name),
        run: getIRCCommandAction("quit")
    },
    {
        name: "mods",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "color",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "ban",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unban",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "clear",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "timeout",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "subscribers",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "subscribersoff",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "slow",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "slowoff",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "r9kbeta", //TODO These aren't currently executed, because they are no valid command with a number, according to imCommands.js
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "r9kbetaoff",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "host",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unhost",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "mod",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "unmod",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    {
        name: "commercial",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            return remoteTwitchCommand(this.name, msg, conv);
        }
    },
    /*{
        name: "w",
        get helpString() _("command_"+this.name),
        run: function(msg, conv, retConv) {
            getAccount(conv).getConversation("#jtv").sendMsg(msg);
            return true;
        }
    }*/
];
