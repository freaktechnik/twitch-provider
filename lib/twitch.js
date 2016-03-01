/*
 * Twitch network provider
 */

//TODO private rooms and whispers? (another server, yay)
//TODO status after aborted auth
//TODO global denormalized username lookup?
//TODO teach ib to change color of a user
//TODO connection closed by server not a connection error?
//TODO switch over to new chat server?
//TODO changing account/two accounts at once -> oAuth login params not passed

const { GenericProtocolPrototype } = require("resource:///modules/jsProtoHelper.jsm");

const { Class } = require("sdk/core/heritage");
const self = require("sdk/self");
const { get: _ } = require("sdk/l10n");

const { registerHandlers } = require("./twitch/handlers");
const TwitchCommands = require("./twitch/commands");
const { TwitchAccount } = require("./twitch/account");
const { ID } = require("./twitch/const");

const TwitchProtocol = Class({
    extends: GenericProtocolPrototype,
    implements: [
        TwitchCommands
    ],
    initialize: function() {
        this.registerCommands();
        registerHandlers();
    },
    get iconBaseURI() {
        return self.data.url();
    },
    get name() {
        return _("twitch_name");
    },
    get id() {
        // The ID should work accross locales.
        return ID;
    },
    get registerNoScreenName() {
        return true;
    },
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

