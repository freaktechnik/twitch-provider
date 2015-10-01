/*
 * Twitch oAuth module
 */

//TODO reauth to fix if token is revoked -> ask what I can do there.
//TODO abort auth if account gets disconnected for a different reason.
//TODO make it possible to auth as multiple users?

const { Task } = require("resource://gre/modules/Task.jsm");

const { prefs } = require("sdk/simple-prefs");
const { defer } = require("sdk/core/promise");
const credentials = require("sdk/passwords");
const self = require("sdk/self");

const { OAuth2 } = require("../OAuth2");


const TOKEN_REALM = "access token";

let searchCredentials = (id) => {
    let { promise, resolve, reject } = defer();

    credentials.search({
        url: self.uri,
        realm: TOKEN_REALM,
        username: id,
        onComplete: (creds) => {
            if(creds.length) {
                resolve(creds[0].password);
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

let currentConnect = new WeakMap();
const auth = (account) => {
    if(!currentConnect.has(account)) {
        const p = defer();

        let twitchOAuth = new OAuth2(
            "https://api.twitch.tv/kraken/oauth2/authorize",
            "channel_editor channel_read chat_login",
            prefs.id
        );

        twitchOAuth.responseType = "token";
        twitchOAuth.completionURI = "http://empty.humanoids.be/nothing.html";
        twitchOAuth.account = account;
        currentConnect.set(account, p.promise);

        twitchOAuth.connect(() => {
            currentConnect.delete(account);

            // Do this in here so it only happens once
            storeTokenInCredentials(twitchOAuth.accessToken, account._nickname);

            p.resolve(twitchOAuth.accessToken);
        }, (e) =>{
            currentConnect.delete(account);
            p.reject(e);
        }, true, true);
    }

    return currentConnect.get(account);
};

// accountID is unique to this twitch user, so there can be multiple twitch
// accounts (in theory)
exports.getToken = Task.async(function*(account) {
    try {
        var token = yield searchCredentials(account._nickname);
    } catch(e) {
        token = yield auth(account);
    }
    return token;
});

exports.purgeToken = function(accountID) {
    let { promise, resolve, reject } = defer();
    credentials.remove({
        url: self.uri,
        realm: TOKEN_REALM,
        username: accountID,
        onComplete: resolve,
        onError: reject
    });
};

exports.fixToken = Task.async(function*(accountID) {
    yield exports.purgeToken(accountID);
    return exports.getToken(accountID);
});
