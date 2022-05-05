"use strict";
exports.__esModule = true;
exports.StemmingTokenizer = void 0;
/**
 * Stemming is the process of reducing search tokens to their root (or stem) so that searches for different forms of a
 * word will match. For example "search", "searching" and "searched" are all reduced to the stem "search".
 *
 * <p>This stemming tokenizer converts tokens (words) to their stem forms before returning them. It requires an
 * external stemming function to be provided; for this purpose I recommend the NPM 'porter-stemmer' library.
 *
 * <p>For more information see http : //tartarus.org/~martin/PorterStemmer/
 */
var StemmingTokenizer = /** @class */ (function () {
    /**
     * Constructor.
     *
     * @param stemmingFunction Function capable of accepting a word and returning its stem.
     * @param decoratedIndexStrategy Index strategy to be run after all stop words have been removed.
     */
    function StemmingTokenizer(stemmingFunction, decoratedTokenizer) {
        this._stemmingFunction = stemmingFunction;
        this._tokenizer = decoratedTokenizer;
    }
    /**
     * @inheritDocs
     */
    StemmingTokenizer.prototype.tokenize = function (text) {
        return this._tokenizer.tokenize(text).map(this._stemmingFunction);
    };
    return StemmingTokenizer;
}());
exports.StemmingTokenizer = StemmingTokenizer;
;
