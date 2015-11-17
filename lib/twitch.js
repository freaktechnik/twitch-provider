/*
 * Twitch network provider
 */

//TODO ignore case for highlights
//TODO Fix sdk frame utils error
//TODO private rooms and whispers?
//TODO optional support for BTTV and those other 3rd party emotes.

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

