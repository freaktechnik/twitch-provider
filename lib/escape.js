/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { CC } = require("chrome");

const TXTToHTMLConv = CC("@mozilla.org/txttohtmlconv;1", "mozITXTToHTMLConv");
let conv = new TXTToHTMLConv();

exports.escapeMsg = function(string) {
    return conv.scanTXT(string, conv.kEntities);
};
