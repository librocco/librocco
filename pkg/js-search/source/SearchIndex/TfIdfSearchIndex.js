"use strict";
exports.__esModule = true;
exports.TfIdfSearchIndex = void 0;
var getNestedFieldValue_1 = require("../getNestedFieldValue");
/**
 * Search index capable of returning results matching a set of tokens and ranked according to TF-IDF.
 */
var TfIdfSearchIndex = /** @class */ (function () {
    function TfIdfSearchIndex(uidFieldName) {
        this._uidFieldName = uidFieldName;
        this._tokenToIdfCache = {};
        this._tokenMap = {};
    }
    /**
     * @inheritDocs
     */
    TfIdfSearchIndex.prototype.indexDocument = function (token, uid, doc) {
        this._tokenToIdfCache = {}; // New index invalidates previous IDF caches
        var tokenMap = this._tokenMap;
        var tokenDatum;
        if (typeof tokenMap[token] !== 'object') {
            tokenMap[token] = tokenDatum = {
                $numDocumentOccurrences: 0,
                $totalNumOccurrences: 1,
                $uidMap: {}
            };
        }
        else {
            tokenDatum = tokenMap[token];
            tokenDatum.$totalNumOccurrences++;
        }
        var uidMap = tokenDatum.$uidMap;
        if (typeof uidMap[uid] !== 'object') {
            tokenDatum.$numDocumentOccurrences++;
            uidMap[uid] = {
                $document: doc,
                $numTokenOccurrences: 1
            };
        }
        else {
            uidMap[uid].$numTokenOccurrences++;
        }
    };
    /**
     * @inheritDocs
     */
    TfIdfSearchIndex.prototype.search = function (tokens, corpus) {
        var uidToDocumentMap = {};
        for (var i = 0, numTokens = tokens.length; i < numTokens; i++) {
            var token = tokens[i];
            var tokenMetadata = this._tokenMap[token];
            // Short circuit if no matches were found for any given token.
            if (!tokenMetadata) {
                return [];
            }
            if (i === 0) {
                var keys = Object.keys(tokenMetadata.$uidMap);
                for (var j = 0, numKeys = keys.length; j < numKeys; j++) {
                    var uid = keys[j];
                    uidToDocumentMap[uid] = tokenMetadata.$uidMap[uid].$document;
                }
            }
            else {
                var keys = Object.keys(uidToDocumentMap);
                for (var j = 0, numKeys = keys.length; j < numKeys; j++) {
                    var uid = keys[j];
                    if (typeof tokenMetadata.$uidMap[uid] !== 'object') {
                        delete uidToDocumentMap[uid];
                    }
                }
            }
        }
        var documents = [];
        for (var uid in uidToDocumentMap) {
            documents.push(uidToDocumentMap[uid]);
        }
        var calculateTfIdf = this._createCalculateTfIdf();
        // Return documents sorted by TF-IDF
        return documents.sort(function (documentA, documentB) { return calculateTfIdf(tokens, documentB, corpus) - calculateTfIdf(tokens, documentA, corpus); });
    };
    TfIdfSearchIndex.prototype._createCalculateIdf = function () {
        var tokenMap = this._tokenMap;
        var tokenToIdfCache = this._tokenToIdfCache;
        return function calculateIdf(token, documents) {
            if (!tokenToIdfCache[token]) {
                var numDocumentsWithToken = typeof tokenMap[token] !== 'undefined' ? tokenMap[token].$numDocumentOccurrences : 0;
                tokenToIdfCache[token] = 1 + Math.log(documents.length / (1 + numDocumentsWithToken));
            }
            return tokenToIdfCache[token];
        };
    };
    TfIdfSearchIndex.prototype._createCalculateTfIdf = function () {
        var tokenMap = this._tokenMap;
        var uidFieldName = this._uidFieldName;
        var calculateIdf = this._createCalculateIdf();
        return function calculateTfIdf(tokens, document, documents) {
            var score = 0;
            for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
                var token = tokens[i];
                var inverseDocumentFrequency = calculateIdf(token, documents);
                if (inverseDocumentFrequency === Infinity) {
                    inverseDocumentFrequency = 0;
                }
                var uid;
                if (uidFieldName instanceof Array) {
                    uid = document && (0, getNestedFieldValue_1["default"])(document, uidFieldName);
                }
                else {
                    uid = document && document[uidFieldName];
                }
                var termFrequency = typeof tokenMap[token] !== 'undefined' && typeof tokenMap[token].$uidMap[uid] !== 'undefined' ? tokenMap[token].$uidMap[uid].$numTokenOccurrences : 0;
                score += termFrequency * inverseDocumentFrequency;
            }
            return score;
        };
    };
    return TfIdfSearchIndex;
}());
exports.TfIdfSearchIndex = TfIdfSearchIndex;
;
