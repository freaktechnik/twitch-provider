/*
 * Twitch Account
 */
"use strict";

const { Ci } = require("chrome");

const { TooltipInfo } = require("resource:///modules/jsProtoHelper.jsm");
const { nsSimpleEnumerator, EmptyEnumerator } = require("resource:///modules/imXPCOMUtils.jsm");
const { Services } = require("resource:///modules/imServices.jsm");

const { Class } = require("sdk/core/heritage");
const { get: _ } = require("sdk/l10n");

const { Account } = require("../irc");
const twitchAPI = require("./api");
const { TwitchChannel } = require("./conversation");
const { WhisperConversation } = require("./whisper-conv");
const twitchAuth = require("./auth");
const { getBadgeName, getChannelFromBadge } = require("./badge");

const BADGE_VERSION_RELEVANT = [ 'bits', 'bits-leader', 'subscriber' ];

const TwitchAccount = Class({
    extends: Account,
    initialize(protocol, account) {
        // "hidden" options for IRC
        protocol.options = {
            "port": { default: 6697 },
            "ssl": { default: true },
            "encoding": { default: "UTF-8" },
            "showServerTab": { default: false }
        };

        this._badges = [];
        this._emotes = [];

        Account.call(this, protocol, account);

        this._server = "irc.chat.twitch.tv";
        this._accountNickname = this.normalizeNick(account.name);
        this._nickname = this._accountNickname;
        this._requestedNickname = this._accountNickname;
    },
    _color: null,
    _badges: [],
    _displayName: null,
    _emotes: [],
    _currentEmoteSets: null,
    shouldAuthenticate: false,
    normalize(str, prefixes) {
        return Account.prototype.normalize.call(this, str.toLowerCase(), prefixes);
    },
    requestRoomInfo(callback) {
        //TODO channel list based on twitch API channels query
        // Use the followed channels as a suggestion?
        callback();
    },
    requestBuddyInfo(nick) {
        let info = EmptyEnumerator;
        if(this.whoisInformation.has(nick)) {
            const whois = this.whoisInformation.get(nick);
            const { badges } = whois;
            if(badges.length > 0) {
                const subs = [],
                    mods = [];
                const infoArr = badges.map((badge) => {
                    const badgeName = getBadgeName(badge);
                    if(badgeName == "sub") {
                        subs.push(getChannelFromBadge(badge));
                        return null;
                    }
                    else if(badgeName == "mod") {
                        mods.push(getChannelFromBadge(badge));
                        return null;
                    }
                    else {
                        if(BADGE_VERSION_RELEVANT.includes(badge)) {
                            return new TooltipInfo(_(`badge_${badge}`), whois[badge]);
                        }
                        return new TooltipInfo(_("badge_" + badge));
                    }
                }).filter((s) => s !== null);

                if(subs.length > 0) {
                    //TODO also expose sub tier.
                    infoArr.push(new TooltipInfo(_("badge_sub"), subs.join(" ")));
                }

                if(mods.length > 0) {
                    infoArr.push(new TooltipInfo(_("badge_mod"), mods.join(" ")));
                }

                info = new nsSimpleEnumerator(infoArr);
            }
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
    async connect() {
        this.reportConnecting();
        let token;
        try {
            token = await twitchAuth.getToken(this);
        }
        catch(e) {
            // Mock socket, so gotDisconnected() works.
            this._socket = { disconnect: () => { /* empty */ } };
            this.gotDisconnected(Ci.prplIAccount.ERROR_AUTHENTICATION_FAILED, _("oauth_failed"));
            throw e;
        }
        twitchAPI.setOAuth(token);

        Account.prototype.connect.call(this);
    },
    // Override the default server auth
    async _connectionRegistration() {
        let token;
        try {
            token = await twitchAuth.getToken(this);
        }
        catch(e) {
            this.gotDisconnected(Ci.prplIAccount.ERROR_AUTHENTICATION_FAILED, _("oauth_failed"));
            throw e;
        }

        this.sendMessage("CAP", "LS");

        this.sendMessage("PASS", "oauth:" + token, "PASS <password not logged>");

        // NICK
        this.changeNick(this._requestedNickname);
    },
    getConversation(name) {
        if(!this.conversations.has(name) && this.isMUCName(name)) {
            this.conversations.set(name, new TwitchChannel(this, name, this._nickname));
        }
        else if(!this.conversations.has(name)) {
            this.conversations.set(name, new WhisperConversation(this, name));
        }
        return this.conversations.get(name);
    },
    addBuddy: () => { /*noop*/ },
    addBadge(badge, version) {
        this.conversations.forEach((conv) => {
            if(conv instanceof Ci.prplIConvChat) {
                conv.getParticipant(this.name).addBadge(badge, version);
            }
        });
    },
    hasBadge(badge) {
        return Array.prototype.some.call(this.conversations.entries(), (conv) => {
            return conv.getParticipant(this.name).hasBadge(badge);
        });
    },
    removeBadge(badge) {
        this.conversations.forEach((conv) => {
            conv.getParticipant(this.name).removeBadge(badge);
        });
    },
    quit() {
        this._reportDisconnecting(Ci.prplIAccount.NO_ERROR);
        this.sendMessage("QUIT", undefined);
    },
    addBadgeToUser(who, badge, version) {
        const whois = this.whoisInformation.get(who);
        if(!whois.badges.includes(badge)) {
            whois.badges.push(badge);
            if(version && BADGE_VERSION_RELEVANT.includes(badge)) {
                //TODO this overrides the sub tier. Should probably store the version in the badge string separated by the slash like in the original tag.
                whois[badge] = version;
            }
        }
    },
    removeBadgeFromUser(who, badge) {
        const whois = this.whoisInformation.get(who);
        if(whois.badges.includes(badge)) {
            whois.badges.splice(whois.badges.indexOf(badge), 1);
        }
        if(whois[badge]) {
            delete whois[badge];
        }
    },
    observe() { /* no away status */ }
});

exports.TwitchAccount = TwitchAccount;
