/*
 * Category Manager Wrapper
 */

const { Cc, Ci } = require("chrome");

const { Class } = require("sdk/core/heritage");
const { Disposable } = require("sdk/core/disposable");

const categoryManager = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);

const models = new WeakMap();
const modelFor = (ce) => models.get(ce);

const deleteEntry = (category, entry) => {
    categoryManager.deleteCategoryEntry(category, entry, false);
};

const CategoryEntry = Class({
    implements: [Disposable],
    setup: function(options) {
        models.set(this, options);

        this.value = options.value;
    },
    get category() {
        return modelFor(this).category;
    },
    get entry() {
        return modelFor(this).entry;
    },
    get value() {
        return modelFor(this).value;
    },
    set value(value) {
        modelFor(this).value = value;

        categoryManager.addCategoryEntry(this.category, this.entry, value, false, true);
    },
    dispose: function() {
        deleteEntry(category, entry, false);

        models.delete(this);
    }
});
exports.CategoryEntry = CategoryEntry;
exports.deleteEntry = deleteEntry;
