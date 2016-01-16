const { Factory } = require("sdk/platform/xpcom");
const self = require("sdk/self");

const { CategoryEntry, deleteEntry } = require("lib/category-manager");
const { TwitchProtocol } = require("lib/twitch");
const { nsSupportsCString } = require("lib/supports-cstring");

const PROTOCOL_CATEGORY = "im-protocol-plugin";


if(self.loadReason == "upgrade" || self.loadReason == "downgrade") {
    // Purge the protocol from the cache in the im core
    deleteEntry(PROTOCOL_CATEGORY, TwitchProtocol.prototype.id);
}

const factory = Factory({
    contract: TwitchProtocol.prototype.contractID,
    Component: TwitchProtocol
});

CategoryEntry({
    category: PROTOCOL_CATEGORY,
    entry: TwitchProtocol.prototype.id,
    value: TwitchProtocol.prototype.contractID
});

