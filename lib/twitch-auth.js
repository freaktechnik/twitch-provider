/*
 * Twitch oAuth module
 */

//TODO figure out how to intercept the account setup dialog.
//TODO reauth to fix if token is revoked

const { prefs } = require("sdk/simple-prefs");
const { defer } = require("sdk/core/promise");
const { Task } = require("resource://gre/modules/Task.jsm");
const { OAuth2 } = require("./OAuth2.jsm");
const credentials = require("sdk/passwords");
const self = require("self");

const TOKEN_REALM = "access token";

let twitchOAuth = new OAuth2(
    "http://api.twitch.tv/oauth/authorize",
    "channel_editor,channel_read,chat_login",
    prefs.id
);

twitchOAuth.responseType = "token";
twitchOAuth.completionURI = "https://oauth.humanoids.be/example";

let searchCredentials = (id) => {
    let { promise, resolve, reject } = defer();

    credentials.search({
        url: self.uri,
        realm: TOKEN_REALM,
        username: id,
        onComplete: (creds) => {
            if(creds.length) {
                resolve(creds[0]);
            }
            else {
                reject();
            }
        },
    });

    return promise;
};

let storeTokenInCredentials = (token, id) => {
    credentials.store({
        realm: TOKEN_REALM,
        username: id,
        password: token
    });
};

let auth = () => {
    let p = defer();

    twitchOAuth.connect(() => {
        p.resolve(twitchOAuth.accessToken);
    }, p.reject, true);

    return p.promise;
};

// accountID is unique to this twitch user, so there can be multiple twitch
// accounts (in theory)
exports.getToken = Task.async(function*(accountID) {
    let token;
    try {
        token = yield searchCredentials(accountID);
    } catch() {
        token = yield auth();
        storeTokenInCredentials(token, accountID);
    } finally {
        return token;
    }
});
