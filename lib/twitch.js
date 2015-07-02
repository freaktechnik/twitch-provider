/*
 * Twitch network provider
 */

//TODO oAuth login
//TODO set user badges
//TODO private rooms and whispers?
//TODO fix not being registered for the category on startup (-> accounts broken)
//TODO Fix sdk frame utils error
//TODO fix overriding existing extension (unregsiter component?)
//TODO ignore case for highlights

const { GenericProtocolPrototype } = require("resource:///modules/jsProtoHelper.jsm");
const { ircHandlers } = require("resource:///modules/ircHandlers.jsm");

const TwitchCommands = require("./twitch-commands");

const { Class } = require("sdk/core/heritage");
const self = require("sdk/self");
const _ = require("sdk/l10n").get;

const { Account } = require("./irc");
const { ctcpHandlers, handlers } = require("./twitch-handlers");
const twitchAPI = require("./twitch-api");
const { TwitchChannel } = require("./twitch-conversation");

const TMI_MEMBERSHIP_CAP = "twitch.tv/membership";
const TMI_COMMANDS_CAP = "twitch.tv/commands";
const TMI_TAGS_CAP = "twitch.tv/tags";

ircHandlers.registerHandler(handlers);
ircHandlers.registerCTCPHandler(ctcpHandlers);

const TwitchAccount = Class({
    extends: Account,
    initialize: function(protocol, account) {
        // "hidden" options for IRC
        protocol.options = {
            "port": { default: 6667 },
            "ssl": { default: false },
            "encoding": { default: "UTF-8" },
            "showServerTab": { default: false }
        };

        this._badges = [];
        this._emotes = [];

        Account.call(this, protocol, account);

        this._server = "irc.twitch.tv";
        this._accountNickname = account.name.toLowerCase();
        this._nickname = this._accountNickname;
        this._requestedNickname = this._accountNickname;

        //TODO twitchAPI.setOAuth(token);
    },
    _color: null,
    _badges: [],
    _displayName: null,
    _emotes: [],
    _currentEmoteSets: null,
    shouldAuthenticate: false,
    requestBuddyInfo: function(buddyName) {
        //TODO avatar via API
        //TODO display name?
    },
    requestRoomInfo: function(callback) {
        //TODO channel list based on twitch API channels query
    },
    chatRoomFields: {
        "channel": {get label() _("twitch_channel_label"), required: true}
    },
    // Override the default server auth
    _connectionRegistration: function() {
        this.sendMessage("PASS", this.imAccount.password, "PASS <password not logged>");

        this.sendMessage("USER", [this.name, this._mode.toString(), "*", this._realname || this._requestedNickname]);

        // NICK
        this.changeNick(this._requestedNickname);

        this.sendMessage("CAP", "LS");

        // get users in channels
        this.sendMessage("CAP", ["REQ", TMI_MEMBERSHIP_CAP]);
        this.addCAP(TMI_MEMBERSHIP_CAP);

        // enable state infos
        this.sendMessage("CAP", ["REQ", TMI_COMMANDS_CAP]);
        this.addCAP(TMI_COMMANDS_CAP);

        // get tags with user infos
        this.sendMessage("CAP", ["REQ", TMI_TAGS_CAP]);
        this.addCAP(TMI_TAGS_CAP);
    },
    getConversation: function(name) {
        if(!this.conversations.has(name) && this.isMUCName(name)) {
            this.conversations.set(name, new TwitchChannel(this, name, this._nickname));
        }
        return this.conversations.get(name);
    }
});

const TwitchProtocol = Class({
    extends: GenericProtocolPrototype,
    implements: [ TwitchCommands ],
    initialize: function() {
        this.registerCommands();
    },
    get iconBaseURI() self.data.url(),
    get name() _("twitch_name"),
    get registerNoScreenName() true,
    get slashCommandsNative() true,
    getAccount: function(aImAccount) {
        return new TwitchAccount(this, aImAccount);
    }
});

exports.TwitchProtocol = TwitchProtocol;

