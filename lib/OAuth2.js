/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Provides OAuth 2.0 authentication
 * From TB source, since I don't think this is anywhere in IB
 * Very rough port to CommonJS and IB. Also some modifications for twitch.
 * @author Martin Giger
 * @license MPL-2.0
 * @module OAuth2
 * @todo Make sure you could log in to 2 different twitch accounts
 */

const { Cc, Ci, Cr } = require("chrome");
const { notifyObservers } = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
const { Class } = require("sdk/core/heritage");
const { Unknown } = require("sdk/platform/xpcom");
const querystring = require("sdk/querystring");
const { Request } = require("sdk/request");
const { get: _ } = require("sdk/l10n");

function parseURLData(aData) {
  let result = {};
  aData.split(/[?#]/, 2)[1].split("&").forEach(function (aParam) {
    let [key, value] = aParam.split("=");
    result[key] = value;
  });
  return result;
}

// Only allow one connecting window per endpoint.
var gConnecting = {};

function OAuth2(aBaseURI, aScope, aAppKey, aAppSecret) {
    this.authURI = aBaseURI;
    this.consumerKey = aAppKey;
    this.consumerSecret = aAppSecret;
    this.scope = aScope;
    this.extraAuthParams = [];
}

OAuth2.CODE_AUTHORIZATION = "authorization_code";
OAuth2.CODE_REFRESH = "refresh_token";

OAuth2.prototype = {
    responseType: "code",
    consumerKey: null,
    consumerSecret: null,
    completionURI: "http://localhost",
    requestWindowURI: "chrome://chat/content/browserRequest.xul",
    requestWindowTitle: "",
    scope: null,
    account: null,

    accessToken: null,
    refreshToken: null,
    tokenExpires: 0,

    connect(aSuccess, aFailure, aWithUI, aRefresh) {
        this.connectSuccessCallback = aSuccess;
        this.connectFailureCallback = aFailure;

        if (!aRefresh && this.accessToken) {
            aSuccess();
        } else if (this.refreshToken) {
            this.requestAccessToken(this.refreshToken, OAuth2.CODE_REFRESH);
        } else {
            if (!aWithUI) {
                aFailure({ "error": "auth_noui" });
                return;
            }
            if (gConnecting[this.authURI]) {
                aFailure("Window already open");
                return;
            }
            this.requestAuthorization();
        }
    },

    requestAuthorization() {
        const paramObj = {
            "response_type": this.responseType,
            "client_id": this.consumerKey,
            "redirect_uri": this.completionURI,
        };
        //TODO doesn't work?
        // Add extra parameters
        this.extraAuthParams.forEach(([k, v]) => paramObj[k] = v);

        // Now map the parameters to a string
        let params = querystring.stringify(params);

        // The scope can be optional. Use the raw scope string
        if (this.scope) {
            params += "&scope=" + this.scope;
        }

        this._browserRequest = new Class({
            extends: Unknown,
            interfaces: [ "prplIRequestBrowser" ],
            get promptText() {
                return _("oauth_login_title")
            },
            account: this.account,
            url: this.authURI + "?" + params,
            _active: true,
            _parent: this,
            cancelled: function() {
                if (!this._active) {
                    return;
                }
                //TODO make this work
                this._parent.finishAuthorizationRequest();
                this._parent.onAuthorizationFailed(Cr.NS_ERROR_ABORT, { "error": "cancelled"});
            },
            loaded: function (aWindow, aWebProgress) {
                if (!this._active) {
                    return;
                }

                this._listener = new Class({
                    extends: Unknown,
                    interfaces: [
                        "nsIWebProgressListener",
                        "nsISupportsWeakReference"
                    ],
                    window: aWindow,
                    webProgress: aWebProgress,
                    _parent: this._parent,
                    _cleanUp() {
                      this.webProgress.removeProgressListener(this);
                      this.window.close();
                      delete this.window;
                    },

                    _checkForRedirect(aURL) {
                      if (aURL.indexOf(this._parent.completionURI) != 0)
                        return;

                      this._parent.finishAuthorizationRequest();
                      this._parent.onAuthorizationReceived(aURL);
                    },

                    onStateChange(aWebProgress, aRequest, aStateFlags, aStatus) {
                      const wpl = Ci.nsIWebProgressListener;
                      if (aStateFlags & (wpl.STATE_START | wpl.STATE_IS_NETWORK))
                        this._checkForRedirect(aRequest.name);
                    },
                    onLocationChange(aWebProgress, aRequest, aLocation) {
                      this._checkForRedirect(aLocation.spec);
                    },
                    onProgressChange() {},
                    onStatusChange() {},
                    onSecurityChange() {},
                })();
                aWebProgress.addProgressListener(this._listener,
                                                 Ci.nsIWebProgress.NOTIFY_ALL);

                aWindow.document.title = this._parent.requestWindowTitle;
            }
        })();

        gConnecting[this.authURI] = true;
        notifyObservers(this._browserRequest, "browser-request", null);
    },
    finishAuthorizationRequest: function() {
        gConnecting[this.authURI] = false;
        if (!("_browserRequest" in this)) {
            return;
        }

        this._browserRequest._active = false;
        if ("_listener" in this._browserRequest) {
            this._browserRequest._listener._cleanUp();
        }
        delete this._browserRequest;
    },

    onAuthorizationReceived: function(aData) {
        let results = parseURLData(aData);
        if (this.responseType == "code" && results.code) {
            this.requestAccessToken(results.code, OAuth2.CODE_AUTHORIZATION);
        } else if (this.responseType == "token" && results.access_token) {
            this.onAccessTokenReceived(results);
        }
        else
          this.onAuthorizationFailed(null, aData);
    },

    onAuthorizationFailed: function(aError, aData) {
        this.connectFailureCallback(aData);
    },

    requestAccessToken: function requestAccessToken(aCode, aType) {
        let params = [
            ["client_id", this.consumerKey],
            ["client_secret", this.consumerSecret],
            ["grant_type", aType],
        ];

        if (aType == OAuth2.CODE_AUTHORIZATION) {
            params.push(["code", aCode]);
            params.push(["redirect_uri", this.completionURI]);
        } else if (aType == OAuth2.CODE_REFRESH) {
            params.push(["refresh_token", aCode]);
        }

        let options = {
          postData: params,
          onLoad: this.onAccessTokenReceived.bind(this),
          onError: this.onAccessTokenFailed.bind(this)
        }
        Request({
            url: this.tokenURI,
            onComplete: (resp) => {
                if(resp.status < 300)
                    this.onAccessTokenReceived(resp.json);
                else
                    this.onAccessTokenFailed(resp.status, resp.text);
            },
            content: params
        }).post();
    },

    onAccessTokenFailed: function onAccessTokenFailed(aError, aData) {
        if (aError != 0) {
            this.refreshToken = null;
        }
        this.connectFailureCallback(aData);
    },

    onAccessTokenReceived: function onRequestTokenReceived(result) {
        this.accessToken = result.access_token;
        if ("refresh_token" in result) {
            this.refreshToken = result.refresh_token;
        }
        if ("expires_in" in result) {
            this.tokenExpires = (new Date()).getTime() + (result.expires_in * 1000);
        } else {
            this.tokenExpires = Number.MAX_VALUE;
        }
        if("token_type" in result) {
            this.tokenType = result.token_type;
        }

        this.connectSuccessCallback();
    }
};

exports.OAuth2 = OAuth2;


