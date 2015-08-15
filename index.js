const { Factory } = require("sdk/platform/xpcom");

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
    value: factory.contract
});


const { Cm, Ci } = require("chrome");

console.log(Cm.QueryInterface(Ci.nsIComponentRegistrar).contractIDToCID(protoInst.contractID).number);
console.log(factory.id.number);

