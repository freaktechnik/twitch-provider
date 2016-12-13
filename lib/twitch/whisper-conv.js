/**
 * Single user conversation override. Just handles the custom sending for now.
 * @todo emotes n shit
 */
"use strict";

const { Conversation } = require("../irc");
const { get: _ } = require("sdk/l10n");

class WhisperConv extends Conversation {
    constructor(account, name) {
        super(account, name);
    }

    sendMsg(message) {
        if(!this._account.sendMessage("PRIVMSG", [ "jtv", `.w ${this.name} ${message}` ])) {
            this.writeMessage(this._account._currentServerName, _("whisper_error"), {
                error: true,
                system: true
            });
            return;
        }

        this.writeMessage(this._account._nickname, message, { outgoing: true, tags: message.tags });
        this._pendingMessage = true;
    }
}
exports.WhisperConversation = WhisperConv;
