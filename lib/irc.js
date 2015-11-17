/*
 * IRC protocol
 */

const { Services: { scriptloader: { loadSubScript }}} = require("resource://gre/modules/Services.jsm");
// the irc.js is a traditional XPCOM component, so it needs Components in its scope
const { components } = require("chrome");

var IRC = { Components: components };

loadSubScript("resource:///components/irc.js", IRC);

exports.Account = IRC.ircAccount;
exports.Channel = IRC.ircChannel;
