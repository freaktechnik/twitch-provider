/*
 * Twitch Account
 */

const { Ci } = require("chrome");

const { Task } = require("resource://gre/modules/Task.jsm");

const { Class } = require("sdk/core/heritage");
const { get: _ } = require("sdk/l10n");

const { Account } = require("../irc");
const twitchAPI = require("./api");
const { TwitchChannel } = require("./conversation");
const twitchAuth = require("./auth");
const { BADGE_CHANNEL_SPLITTER } = require("./const");

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
    requestBuddyInfo: function(nick) {
        // nothing to do here
    },
    chatRoomFields: {
        "channel": {
            get label() {
                return _("twitch_channel_label");
            },
            required: true
        }
    },
    connect: Task.async(function*() {
        this.reportConnecting();
        try {
            var token = yield twitchAuth.getToken(this);
        } catch(e) {
            this.gotDisconnected(Ci.prplIAccount.ERROR_AUTHENTICATION_FAILED, _("oauth_failed"));
            throw e;
        }
        twitchAPI.setOAuth(token);

        Account.prototype.connect.call(this);
    }),
    // Override the default server auth
    _connectionRegistration: Task.async(function*() {
        try {
            var token = yield twitchAuth.getToken(this);
        } catch(e) {
            this.gotDisconnected(Ci.prplIAccount.ERROR_AUTHENTICATION_FAILED, _("oauth_failed"));
            throw e;
        }

        this.sendMessage("CAP", "LS");

        this.sendMessage("PASS", "oauth:"+token, "PASS <password not logged>");

        // NICK
        this.changeNick(this._requestedNickname);
    }),
    getConversation: function(name) {
        if(!this.conversations.has(name) && this.isMUCName(name)) {
            this.conversations.set(name, new TwitchChannel(this, name, this._nickname));
        }
        return this.conversations.get(name);
    },
    addBuddy: () => {/*noop*/},
    addBadge: function(badge) {
        // Check if the badge is channel-specific
        if(badge.split(BADGE_CHANNEL_SPLITTER).length > 1) {
            this.getConversation(channel).getParticipant(this.name).addBadge(badge);
        }
        else {
            for(let conv in this.conversations) {
                conv.getParticipant(this.name).addBadge(badge);
            }
        }
    },
    quit() {
        this._reportDisconnecting(Ci.prplIAccount.NO_ERROR);
        this.sendMessage("QUIT", undefined);
    }
});

exports.TwitchAccount = TwitchAccount;
