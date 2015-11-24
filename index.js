const { Factory } = require("sdk/platform/xpcom");
const { uuid } = require("sdk/util/uuid");
const self = require("sdk/self");

const { CategoryEntry } = require("lib/category-manager");
const { TwitchProtocol } = require("lib/twitch");
const handlers = require("lib/twitch/handlers");

const PROTOCOL_CATEGORY = "im-protocol-plugin";

let protoInst = new TwitchProtocol();

if(self.loadReason == "upgrade" || self.loadReason == "downgrade") {
    //TODO delete category entry?
    handlers.cleanUp();
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

