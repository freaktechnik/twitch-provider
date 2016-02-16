/*
 * Twitch network provider
 */

//TODO private rooms and whispers?
//TODO possibility to use with bouncers? (configure custom server & port) -> expose server, port and SSL pref per account?
//TODO auto join channels?
//TODO status after aborted auth
//TODO fix useage of turbo emotes for the outgoing messages
//TODO fix emotes loading messing up scrolling
//TODO load participants before joining channel - how?
//TODO make sure buddies correctly get renamed and don't duplicate
//TODO twitch <3 not working?
//TODO global denormalized username lookup (&avatar)?
//TODO teach ib to change color of a user
//TODO Thunderbird?

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

