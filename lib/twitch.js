/*
 * Twitch network provider
 */

//TODO use display names for users in the user list
//TODO set user badges
//TODO private rooms and whispers?
//TODO oAuth login
//TODO fix not being registered for the category on startup (-> accounts broken)
//TODO fix overriding existing extension (unregsiter component?)

const { GenericProtocolPrototype, Message } = require("resource:///modules/jsProtoHelper.jsm");
const { ircHandlers } = require("resource:///modules/ircHandlers.jsm");
const { addGlobalAllowedTag, addGlobalAllowedAttribute, addGlobalAllowedStyleRule, createDerivedRuleset, cleanupImMarkup } = require("resource:///modules/imContentSink.jsm");

const TwitchCommands = require("./twitch-commands");

const { Class } = require("sdk/core/heritage");
const self = require("sdk/self");
const _ = require("sdk/l10n").get;

const { Account, Channel } = require("./irc");
const { ctcpHandlers, handlers } = require("./twitch-handlers");
const twitchAPI = require("./twitch-api");

const TMI_MEMBERSHIP_CAP = "twitch.tv/membership";
const TMI_COMMANDS_CAP = "twitch.tv/commands";
const TMI_TAGS_CAP = "twitch.tv/tags";

const ACTION_START = "/me ";

// See http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javscript-regex
const escapeForRegExp = (str) => str.replace(/[\-\[\]\/\(\)\{\}\*\+\?\.\\\^\$\|]/g, "\\$&");
const replaceEmoticon = (msg, code, id) => msg.replace(new RegExp("(^|\\s)("+code+")(?=\\s|$)", "g"), "$1<img alt='$2' src='http://static-cdn.jtvnw.net/emoticons/v1/"+id+"/1.0' style='vertical-align: middle;'>")

ircHandlers.registerHandler(handlers);
ircHandlers.registerCTCPHandler(ctcpHandlers);

createDerivedRuleset();
addGlobalAllowedTag("img");
addGlobalAllowedAttribute("src");
addGlobalAllowedAttribute("alt");
addGlobalAllowedStyleRule("vertical-align");

let msgMeta = new Map();

const TwitchMessage = Class({
    extends: Message,
    initialize: function(who, text, obj, conv) {
        msgMeta.set(this._lastId+1, obj);
        this._init(who, text, obj);
        this.conversation = conv;
    }
});

const TwitchChannel = Class({
    extends: Channel,
    initialize: function(account, convName, nick) {
        Channel.call(this, account, convName, nick);
    },
    writeMessage: function(who, msg, obj) {
        new TwitchMessage(who, msg, obj, this);
    },
    prepareForDisplaying: function(msg) {
        let meta;
        if(!msg.system) {
            meta = msgMeta.get(msg.id);
            msgMeta.delete(msg.id);

            //TODO find a way that actually works to set the message color
            //msg.color = meta.color;
        }

        Channel.prototype.prepareForDisplaying.call(this, msg);

        if(meta && meta.emotes && !meta.system) {
            meta.emotes.forEach((emote) => {
                let [id, firstBegin, firstEnd, ...occurences] = emote.split(/[-:,]/);

                if(msg.message.indexOf(ACTION_START) == 0) {
                    firstBegin = parseInt(firstBegin, 10) + ACTION_START.length;
                    firstEnd = parseInt(firstEnd, 10) + ACTION_START.length;
                }

                let emoteSequence = msg.message.substring(parseInt(firstBegin, 10), parseInt(firstEnd, 10)+1);

                msg.displayMessage = replaceEmoticon(msg.displayMessage, escapeForRegExp(emoteSequence), id);
            });
        }

        if(meta && meta.outgoing && !meta.system) {
            this.wrappedJSObject._account._emotes.forEach((emote) => {
                msg.displayMessage = replaceEmoticon(msg.displayMessage, emote.code, emote.id);
            });
        }
    },
    //TODO topicSettable depending on user privileges (channel editor, needs oauth)
    get topicSettable() false
    //TODO set _topic every now and then
    //TODO set topic() {}
});


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

