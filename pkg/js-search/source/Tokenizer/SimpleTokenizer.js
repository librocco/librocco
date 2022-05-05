"use strict";
exports.__esModule = true;
exports.SimpleTokenizer = void 0;
var REGEX = /[^a-zа-яё0-9\-']+/i;
/**
 * Simple tokenizer that splits strings on whitespace characters and returns an array of all non-empty substrings.
 */
var SimpleTokenizer = /** @class */ (function () {
    function SimpleTokenizer() {
    }
    /**
     * @inheritDocs
     */
    SimpleTokenizer.prototype.tokenize = function (text) {
        return text.split(REGEX).filter(function (text) { return text; } // Filter empty tokens
        );
    };
    return SimpleTokenizer;
}());
exports.SimpleTokenizer = SimpleTokenizer;
;
