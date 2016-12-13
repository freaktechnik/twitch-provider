/*
 * String bundle wrapper
 */

const { Cc, Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");
const { setImmediate } = require("sdk/timers");

const sbs = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);

const strbundles = new WeakMap();
const modelFor = (sb) => strbundles.get(sb);

const StringBundle = Class({
    implements: [ Disposable ],
    setup(uri) {
        strbundles.set(this, sbs.createBundle(uri));
    },
    get(name, ...args) {
        if(args.length) {
            return this.getFormattedString(name, args);
        }
        else {
            return this.getString(name);
        }
    },
    getString(name) {
        return modelFor(this).GetStringFromName(name);
    },
    getFormattedString(name, params) {
        return modelFor(this).formatStringFromName(name, params);
    },
    forEach(callback, thisArg) {
        const it = modelFor(this).getSimpleEnumeration();
        let element;

        while(it.hasMoreElements()) {
            element = it.getNext().QueryInterface(Ci.nsIPropertyElement);
            callback.call(thisArg, element.value, element.key);
        }
    },
    dispose() {
        strbundles.delete(this);
    }
});

exports.StringBundle = StringBundle;
