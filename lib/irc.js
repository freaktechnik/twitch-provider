/*
 * IRC protocol
 */

const { Services: { scriptloader: { loadSubScript }}} = require("resource://gre/modules/Services.jsm");
let IRC = {};

// the irc.js is a traditional XPCOM component, so it needs Components in its scope
let { components: Components } = require("chrome");

loadSubScript("resource:///components/irc.js", IRC);

exports.Account = IRC.ircAccount;
exports.Channel = IRC.ircChannel;

// make sure all the default IRC handlers get registered;
new IRC.ircProtocol();
