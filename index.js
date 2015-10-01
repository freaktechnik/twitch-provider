const { Factory } = require("sdk/platform/xpcom");
const { uuid } = require("sdk/util/uuid");

//TODO test if uuid removes some of the reregistration trouble

const { CategoryEntry } = require("lib/category-manager");
const { TwitchProtocol } = require("lib/twitch");


const PROTOCOL_CATEGORY = "im-protocol-plugin";

let protoInst = new TwitchProtocol();

const factory = Factory({
    contract: protoInst.contractID,
    Component: TwitchProtocol,
    id: uuid("{b6ab1814-4333-11e5-b78d-40167e9a3b91}")
});

CategoryEntry({
    category: PROTOCOL_CATEGORY,
    entry: protoInst.id,
    value: protoInst.contractID
});

