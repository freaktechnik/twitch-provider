"use strict";
const SIZES = {
    "1x": "1.0",
    "2x": "2.0",
    "3x": "3.0",
    "4x": "4.0",
    "5x": "5.0"
};
// See http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javscript-regex
const escapeForRegExp = (str) => str.replace(/[\-\[\]\/\(\)\{\}\*\+\?\.\\\^\$\|]/g, "\\$&");
exports.escapeForRegExp = escapeForRegExp;
const getTwitchSrcset = (id) => {
    const imgUrl = "http://static-cdn.jtvnw.net/emoticons/v1/" + id +"/";
    return Object.keys(SIZES).map((x) => imgUrl + SIZES[x] + " " + x).join(",");
};
exports.getTwitchSrcset = getTwitchSrcset;
const getImg = (name, srcset) => "<img alt='" + name + "' title='" + name + "' srcset='" + srcset + "' style='vertical-align: middle;'>"
exports.getImg = getImg;
const replaceEmoticon = (msg, code, id) => {
    const srcset = getTwitchSrcset(id);
    return replaceEmote(msg, code, srcset);
};
exports.replaceEmoticon;

// This is factored out of replaceEmoticon for generalization. I tend to avoid
// rewrites. Wait, that's actually a lie. But I'm lazy today.
const replaceEmote = (msg, code, srcset) => {
    // Replace emotes only if they are free standing
    const pattern = new RegExp("(^|\\s)"+code+"(?=\\s|$)", "g");
    let count = 0;
    const newMsg = msg.replace(pattern, (math, p1) => {
        ++count;
        return p1 + getImg(math, srcset);
    });
    return [ newMsg, count ];
};
exports.replaceEmote = replaceEmote;

const replaceCharacters = (msg, start, end, srcset) => {
    const code = msg.substring(start, end);
    const img = getImg(escapeMsg(code), srcset);
    const newMsg = msg.substring(0, start) + img + msg.substring(end);
    return [ newMsg, img.length - code.length ];
};
exports.replaceCharacters = exports.replaceCharacters;
