"use strict";
exports.__esModule = true;
exports.TokenHighlighter = void 0;
var index_1 = require("./IndexStrategy/index");
var index_2 = require("./Sanitizer/index");
/**
 * This utility highlights the occurrences of tokens within a string of text. It can be used to give visual indicators
 * of match criteria within searchable fields.
 *
 * <p>For performance purposes this highlighter only works with full-word or prefix token indexes.
 */
var TokenHighlighter = /** @class */ (function () {
    /**
     * Constructor.
     *
     * @param opt_indexStrategy Index strategy used by Search
     * @param opt_sanitizer Sanitizer used by Search
     * @param opt_wrapperTagName Optional wrapper tag name; defaults to 'mark' (e.g. <mark>)
     */
    function TokenHighlighter(opt_indexStrategy, opt_sanitizer, opt_wrapperTagName) {
        this._indexStrategy = opt_indexStrategy || new index_1.PrefixIndexStrategy();
        this._sanitizer = opt_sanitizer || new index_2.LowerCaseSanitizer();
        this._wrapperTagName = opt_wrapperTagName || 'mark';
    }
    /**
     * Highlights token occurrences within a string by wrapping them with a DOM element.
     *
     * @param text e.g. "john wayne"
     * @param tokens e.g. ["wa"]
     * @returns {string} e.g. "john <mark>wa</mark>yne"
     */
    TokenHighlighter.prototype.highlight = function (text, tokens) {
        var tagsLength = this._wrapText('').length;
        var tokenDictionary = Object.create(null);
        // Create a token map for easier lookup below.
        for (var i = 0, numTokens = tokens.length; i < numTokens; i++) {
            var token = this._sanitizer.sanitize(tokens[i]);
            var expandedTokens = this._indexStrategy.expandToken(token);
            for (var j = 0, numExpandedTokens = expandedTokens.length; j < numExpandedTokens; j++) {
                var expandedToken = expandedTokens[j];
                if (!tokenDictionary[expandedToken]) {
                    tokenDictionary[expandedToken] = [token];
                }
                else {
                    tokenDictionary[expandedToken].push(token);
                }
            }
        }
        // Track actualCurrentWord and sanitizedCurrentWord separately in case we encounter nested tags.
        var actualCurrentWord = '';
        var sanitizedCurrentWord = '';
        var currentWordStartIndex = 0;
        // Note this assumes either prefix or full word matching.
        for (var i = 0, textLength = text.length; i < textLength; i++) {
            var character = text.charAt(i);
            if (character === ' ') {
                actualCurrentWord = '';
                sanitizedCurrentWord = '';
                currentWordStartIndex = i + 1;
            }
            else {
                actualCurrentWord += character;
                sanitizedCurrentWord += this._sanitizer.sanitize(character);
            }
            if (tokenDictionary[sanitizedCurrentWord] && tokenDictionary[sanitizedCurrentWord].indexOf(sanitizedCurrentWord) >= 0) {
                actualCurrentWord = this._wrapText(actualCurrentWord);
                text = text.substring(0, currentWordStartIndex) + actualCurrentWord + text.substring(i + 1);
                i += tagsLength;
                textLength += tagsLength;
            }
        }
        return text;
    };
    /**
     * @param text to wrap
     * @returns Text wrapped by wrapper tag (e.g. "foo" becomes "<mark>foo</mark>")
     * @private
     */
    TokenHighlighter.prototype._wrapText = function (text) {
        var tagName = this._wrapperTagName;
        return "<".concat(tagName, ">").concat(text, "</").concat(tagName, ">");
    };
    return TokenHighlighter;
}());
exports.TokenHighlighter = TokenHighlighter;
;
