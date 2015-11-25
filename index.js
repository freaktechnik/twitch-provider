const { Factory } = require("sdk/platform/xpcom");
const self = require("sdk/self");
const { Services: { obs } } = require("resource:///modules/imServices.jsm");
const { CC } = require("chrome");

const { CategoryEntry } = require("lib/category-manager");
const { TwitchProtocol } = require("lib/twitch");
const { nsSupportsCString } = require("lib/supports-cstring");

const PROTOCOL_CATEGORY = "im-protocol-plugin";

let protoInst = new TwitchProtocol();

if(self.loadReason == "upgrade" || self.loadReason == "downgrade") {
    // Purge the protocol from the cache in the im core
    obs.notifyObservers(
        nsSupportsCString(protoInst.id),
        "xpcom-category-entry-removed",
        PROTOCOL_CATEGORY
    );
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

