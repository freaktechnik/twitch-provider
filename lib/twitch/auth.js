/*
 * Twitch oAuth module
 */
"use strict";
//TODO reauth to fix if token is revoked -> ask what I can do there.
//TODO abort auth if account gets disconnected for a different reason.
//TODO make it possible to auth as multiple users?

const { prefs } = require("sdk/simple-prefs");
const { defer } = require("sdk/core/promise");
const credentials = require("sdk/passwords");
const self = require("sdk/self");

const { OAuth2 } = require("../OAuth2");


const TOKEN_REALM = "access token";

const searchCredentials = (id) => {
    return new Promise((resolve, reject) => {
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
    });
};

const storeTokenInCredentials = (token, id) => {
    credentials.store({
        realm: TOKEN_REALM,
        username: id,
        password: token
    });
};

const currentConnect = new WeakMap();
const auth = (account) => {
    if(!currentConnect.has(account)) {
        const p = defer();

        const twitchOAuth = new OAuth2(
            "https://api.twitch.tv/kraken/oauth2/authorize",
            "channel_editor+chat_login",
            prefs.id
        );

        twitchOAuth.responseType = "token";
        twitchOAuth.completionURI = "http://empty.humanoids.be/nothing.html";
        twitchOAuth.account = account;
        twitchOAuth.extraAuthParams.push([ "login", account._nickname ]);
        //TODO "not you?" button doesn't work -> force_verify is useless
        twitchOAuth.extraAuthParams.push([ "force_verify", "true" ]);
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
exports.getToken = async (account) => {
    let token;
    try {
        token = await searchCredentials(account._nickname);
    }
    catch(e) {
        token = await auth(account);
    }
    return token;
};

exports.purgeToken = function(accountID) {
    return new Promise((resolve, reject) => {
        credentials.remove({
            url: self.uri,
            realm: TOKEN_REALM,
            username: accountID,
            onComplete: resolve,
            onError: reject
        });
    });
};

exports.fixToken = async (accountID) => {
    await exports.purgeToken(accountID);
    return exports.getToken(accountID);
};
