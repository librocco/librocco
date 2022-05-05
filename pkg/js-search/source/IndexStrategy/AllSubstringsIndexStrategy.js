"use strict";
exports.__esModule = true;
exports.AllSubstringsIndexStrategy = void 0;
/**
 * Indexes for all substring searches (e.g. the term "cat" is indexed as "c", "ca", "cat", "a", "at", and "t").
 */
var AllSubstringsIndexStrategy = /** @class */ (function () {
    function AllSubstringsIndexStrategy() {
    }
    /**
     * @inheritDocs
     */
    AllSubstringsIndexStrategy.prototype.expandToken = function (token) {
        var expandedTokens = [];
        var string;
        for (var i = 0, length = token.length; i < length; ++i) {
            string = '';
            for (var j = i; j < length; ++j) {
                string += token.charAt(j);
                expandedTokens.push(string);
            }
        }
        return expandedTokens;
    };
    return AllSubstringsIndexStrategy;
}());
exports.AllSubstringsIndexStrategy = AllSubstringsIndexStrategy;
;
