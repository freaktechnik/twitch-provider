/*
 * Twitch network provider
 */

//TODO fix not being registered for the category on startup (-> accounts broken)
//TODO Fix sdk frame utils error
//TODO fix overriding existing extension (unregsiter component?)
//TODO ignore case for highlights
//TODO set user badges
//TODO private rooms and whispers?

const { GenericProtocolPrototype } = require("resource:///modules/jsProtoHelper.jsm");
const { ircHandlers } = require("resource:///modules/ircHandlers.jsm");

const { Class } = require("sdk/core/heritage");
const self = require("sdk/self");
const { get: _ } = require("sdk/l10n");

const { ctcpHandlers, handlers, capHandlers } = require("./twitch/handlers");
const TwitchCommands = require("./twitch/commands");
const { TwitchAccount } = require("./twitch/account");


ircHandlers.registerHandler(handlers);
ircHandlers.registerCTCPHandler(ctcpHandlers);
ircHandlers.registerCAPHandler(capHandlers);

const TwitchProtocol = Class({
    extends: GenericProtocolPrototype,
    implements: [ TwitchCommands ],
    initialize: function() {
        this.registerCommands();
    },
    get iconBaseURI() {
        return self.data.url();
    },
    get name() {
        return _("twitch_name");
    },
    get registerNoScreenName() {
        return true;
    }
    get slashCommandsNative() {
        return true;
    },
    get chatHasTopic() {
        return true;
    },
    get noPassword() {
        return true;
    },
    getAccount: function(aImAccount) {
        return new TwitchAccount(this, aImAccount);
    }
});

exports.TwitchProtocol = TwitchProtocol;

