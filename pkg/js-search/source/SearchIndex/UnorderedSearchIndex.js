"use strict";
exports.__esModule = true;
exports.UnorderedSearchIndex = void 0;
/**
 * Search index capable of returning results matching a set of tokens but without any meaningful rank or order.
 */
var UnorderedSearchIndex = /** @class */ (function () {
    function UnorderedSearchIndex() {
        this._tokenToUidToDocumentMap = {};
    }
    /**
     * @inheritDocs
     */
    UnorderedSearchIndex.prototype.indexDocument = function (token, uid, doc) {
        if (typeof this._tokenToUidToDocumentMap[token] !== 'object') {
            this._tokenToUidToDocumentMap[token] = {};
        }
        this._tokenToUidToDocumentMap[token][uid] = doc;
    };
    /**
     * @inheritDocs
     */
    UnorderedSearchIndex.prototype.search = function (tokens, corpus) {
        var intersectingDocumentMap = {};
        var tokenToUidToDocumentMap = this._tokenToUidToDocumentMap;
        for (var i = 0, numTokens = tokens.length; i < numTokens; i++) {
            var token = tokens[i];
            var documentMap = tokenToUidToDocumentMap[token];
            // Short circuit if no matches were found for any given token.
            if (!documentMap) {
                return [];
            }
            if (i === 0) {
                var keys = Object.keys(documentMap);
                for (var j = 0, numKeys = keys.length; j < numKeys; j++) {
                    var uid = keys[j];
                    intersectingDocumentMap[uid] = documentMap[uid];
                }
            }
            else {
                var keys = Object.keys(intersectingDocumentMap);
                for (var j = 0, numKeys = keys.length; j < numKeys; j++) {
                    var uid = keys[j];
                    if (typeof documentMap[uid] !== 'object') {
                        delete intersectingDocumentMap[uid];
                    }
                }
            }
        }
        var keys = Object.keys(intersectingDocumentMap);
        var documents = [];
        for (var i = 0, numKeys = keys.length; i < numKeys; i++) {
            var uid = keys[i];
            documents.push(intersectingDocumentMap[uid]);
        }
        return documents;
    };
    return UnorderedSearchIndex;
}());
exports.UnorderedSearchIndex = UnorderedSearchIndex;
;
