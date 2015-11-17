const { Factory } = require("sdk/platform/xpcom");
const { uuid } = require("sdk/util/uuid");

//TODO test if uuid removes some of the reregistration trouble

const { CategoryEntry } = require("lib/category-manager");
const { TwitchProtocol } = require("lib/twitch");


const PROTOCOL_CATEGORY = "im-protocol-plugin";

let protoInst = new TwitchProtocol();

const factory = Factory({
    contract: protoInst.contractID,
    Component: TwitchProtocol
});

CategoryEntry({
    category: PROTOCOL_CATEGORY,
    entry: protoInst.id,
    value: protoInst.contractID
});

