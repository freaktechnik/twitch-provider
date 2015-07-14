/*
 * Twitch oAuth module
 */

//TODO think about how to inject oAuth into the acount dialog.

const { openDialog } = require("sdk/window/utils");
const { stringify } = require("sdk/querystring");
const { prefs } = require("sdk/simple-prefs");
const { PageMod } = require("sdk/page-mod");
const { defer } = require("sdk/core/promise");
const { modelFor } = require("sdk/model/core");

const oAuthRedirectUri = "https://oauth.humanoids.be/example";

exports.auth = function(username) {
    let p = defer();

    let worker = PageMod({
        include: oAuthRedirectUri,
        contentScriptFile: "./auth.js"
    });

    //TODO make the dialog modal
    let win = openDialog({
        url: "https://api.twitch.tv/kraken/oauth2/authorize?"+stringify({
            "response_type": "token",
            "client_id": prefs.id,
            "redirect_uri": oAuthRedirectUri,
            "scope": "channel_editor,channel_read,chat_login",
        features: "modal,chrome=no,all"
        })
    });

    let expected = false;

    modelFor(win).once("close", () => {
        if(!expected)
            p.reject();
    });

    worker.port.on("close", (code) => {
        p.resolve(code);
        expected = true;
        win.close();
        worker.destroy();
    });

    worker.port.on("abort", () => {
        p.reject();
        expected = true;
        win.close();
        worker.destroy();
    });

    return p.promise;
};
