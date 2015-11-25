const { Factory } = require("sdk/platform/xpcom");
const self = require("sdk/self");

const { CategoryEntry, deleteEntry } = require("lib/category-manager");
const { TwitchProtocol } = require("lib/twitch");
const { nsSupportsCString } = require("lib/supports-cstring");

const PROTOCOL_CATEGORY = "im-protocol-plugin";

let protoInst = new TwitchProtocol();

if(self.loadReason == "upgrade" || self.loadReason == "downgrade") {
    // Purge the protocol from the cache in the im core
    deleteEntry(PROTOCOL_CATEGORY, protoInst.id);
}

const factory = Factory({
    contract: protoInst.contractID,
    Component: TwitchProtocol
});

CategoryEntry({
    category: PROTOCOL_CATEGORY,
    entry: protoInst.id,
    value: protoInst.contractID
});

