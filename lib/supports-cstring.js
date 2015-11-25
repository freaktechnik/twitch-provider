/**
 * nsISupportsCString "implementation".
 * @author Martin Giger
 * @license MPL-2.0
 * @module lib/supports-cstring
 */
"use string";

const { CC } = require("chrome");

const nsSupportsCString = CC("@mozilla.org/supports-cstring;1", "nsISupportsCString");

const supportsCString = function(data) {
    let str = new nsSupportsCString();
    str.data = data;
    return str;
};

exports.nsSupportsCString = supportsCString;
