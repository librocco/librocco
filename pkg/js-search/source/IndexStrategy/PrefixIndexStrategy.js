"use strict";
exports.__esModule = true;
exports.PrefixIndexStrategy = void 0;
/**
 * Indexes for prefix searches (e.g. the term "cat" is indexed as "c", "ca", and "cat" allowing prefix search lookups).
 */
var PrefixIndexStrategy = /** @class */ (function () {
    function PrefixIndexStrategy() {
    }
    /**
     * @inheritDocs
     */
    PrefixIndexStrategy.prototype.expandToken = function (token) {
        var expandedTokens = [];
        var string = '';
        for (var i = 0, length = token.length; i < length; ++i) {
            string += token.charAt(i);
            expandedTokens.push(string);
        }
        return expandedTokens;
    };
    return PrefixIndexStrategy;
}());
exports.PrefixIndexStrategy = PrefixIndexStrategy;
;
