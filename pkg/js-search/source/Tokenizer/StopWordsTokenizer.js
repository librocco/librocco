"use strict";
exports.__esModule = true;
exports.StopWordsTokenizer = void 0;
var StopWordsMap_1 = require("../StopWordsMap");
/**
 * Stop words are very common (e.g. "a", "and", "the") and are often not semantically meaningful in the context of a
 * search. This tokenizer removes stop words from a set of tokens before passing the remaining tokens along for
 * indexing or searching purposes.
 */
var StopWordsTokenizer = /** @class */ (function () {
    /**
     * Constructor.
     *
     * @param decoratedIndexStrategy Index strategy to be run after all stop words have been removed.
     */
    function StopWordsTokenizer(decoratedTokenizer) {
        this._tokenizer = decoratedTokenizer;
    }
    /**
     * @inheritDocs
     */
    StopWordsTokenizer.prototype.tokenize = function (text) {
        return this._tokenizer.tokenize(text).filter(function (token) { return !StopWordsMap_1.StopWordsMap[token]; });
    };
    return StopWordsTokenizer;
}());
exports.StopWordsTokenizer = StopWordsTokenizer;
;
