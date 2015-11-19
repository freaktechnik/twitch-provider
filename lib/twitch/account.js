/*
 * Twitch Account
 */

const { Ci } = require("chrome");

const { Task } = require("resource://gre/modules/Task.jsm");
const { TooltipInfo } = require("resource:///modules/jsProtoHelper.jsm");
const { nsSimpleEnumerator, EmptyEnumerator } = require("resource:///modules/imXPCOMUtils.jsm");
const { Services } = require("resource:///modules/imServices.jsm");

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
        // Use the followed channels as a suggestion?
    },
    requestBuddyInfo: function(nick) {
        let { badges } = this.whoisInformation.get(nick);
        let info;
        if(badges.length === 0) {
            info = EmptyEnumerator;
        }
        else {
            let subs = [], mods = [];
            let infoArr = badges.map((badge) => {
                if(badge.includes(BADGE_CHANNEL_SPLITTER)) {
                    let badgeArr = badge.split(BADGE_CHANNEL_SPLITTER);
                    if(badgeArr[0] == "sub")
                        subs.push(badgeArr[1]);
                    else
                        mods.push(badgeArr[1]);
                    return null;
                }
                else {
                    return new TooltipInfo(_("badge_"+badge));
                }
            }).filter((s) => s !== null);

            if(subs.length > 0)
                infoArr.push(new TooltipInfo(_("badge_sub"), subs.join(" ")));

            if(mods.length > 0)
                infoArr.push(new TooltipInfo(_("badge_mod"), mods.join(" ")));

            info = new nsSimpleEnumerator(infoArr);
        }
        Services.obs.notifyObservers(info, "user-info-received", nick);
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
        this.conversations.forEach((conv) => {
            conv.getParticipant(this.name).addBadge(badge);
        });
    },
    quit() {
        this._reportDisconnecting(Ci.prplIAccount.NO_ERROR);
        this.sendMessage("QUIT", undefined);
    },
    addBadgeToUser(who, badge) {
        let whois = this.whoisInformation.get(who);
        if(!whois.badges.includes(badge))
            whois.badges.push(badge);
    },
    observe() { /* no away status */ }
});

exports.TwitchAccount = TwitchAccount;
