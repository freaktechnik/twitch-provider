/*
 * Twitch Account
 */

const { Task } = require("resource://gre/modules/Task.jsm");

const { Class } = require("sdk/core/heritage");
const { get: _ } = require("sdk/10n");

const { Account } = require("../irc");
const twitchAPI = require("./api");
const { TwitchChannel } = require("./conversation");
const twitchAuth = require("./auth");

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

        twitchAuth.getToken(this._nickname).then(twitchAPI.setOAuth);
    },
    _color: null,
    _badges: [],
    _displayName: null,
    _emotes: [],
    _currentEmoteSets: null,
    shouldAuthenticate: false,
    requestRoomInfo: function(callback) {
        //TODO channel list based on twitch API channels query
    },
    chatRoomFields: {
        "channel": {
            get label() {
                return _("twitch_channel_label");
            },
            required: true
        }
    },
    // Override the default server auth
    _connectionRegistration: Task.async(function*() {
        let token = yield twitchAuth.getToken(this._nickname);
        this.sendMessage("PASS", token, "PASS <password not logged>");

        this.sendMessage("USER", [this.name, this._mode.toString(), "*", this._realname || this._requestedNickname]);

        // NICK
        this.changeNick(this._requestedNickname);

        this.sendMessage("CAP", "LS");
    }),
    getConversation: function(name) {
        if(!this.conversations.has(name) && this.isMUCName(name)) {
            this.conversations.set(name, new TwitchChannel(this, name, this._nickname));
        }
        return this.conversations.get(name);
    },
    addBuddy: () => {/*noop*/}
});

exports.TwitchAccount = TwitchAccount;
