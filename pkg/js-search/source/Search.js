"use strict";
exports.__esModule = true;
exports.Search = void 0;
var getNestedFieldValue_1 = require("./getNestedFieldValue");
var index_1 = require("./IndexStrategy/index");
var index_2 = require("./Sanitizer/index");
var index_3 = require("./SearchIndex/index");
var index_4 = require("./Tokenizer/index");
/**
 * Simple client-side searching within a set of documents.
 *
 * <p>Documents can be searched by any number of fields. Indexing and search strategies are highly customizable.
 */
var Search = /** @class */ (function () {
    /**
     * Constructor.
     * @param uidFieldName Field containing values that uniquely identify search documents; this field's values are used
     *                     to ensure that a search result set does not contain duplicate objects.
     */
    function Search(uidFieldName) {
        if (!uidFieldName) {
            throw Error('js-search requires a uid field name constructor parameter');
        }
        this._uidFieldName = uidFieldName;
        // Set default/recommended strategies
        this._indexStrategy = new index_1.PrefixIndexStrategy();
        this._searchIndex = new index_3.TfIdfSearchIndex(uidFieldName);
        this._sanitizer = new index_2.LowerCaseSanitizer();
        this._tokenizer = new index_4.SimpleTokenizer();
        this._documents = [];
        this._searchableFields = [];
    }
    Object.defineProperty(Search.prototype, "indexStrategy", {
        get: function () {
            return this._indexStrategy;
        },
        /**
         * Override the default index strategy.
         * @param value Custom index strategy
         * @throws Error if documents have already been indexed by this search instance
         */
        set: function (value) {
            if (this._initialized) {
                throw Error('IIndexStrategy cannot be set after initialization');
            }
            this._indexStrategy = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Search.prototype, "sanitizer", {
        get: function () {
            return this._sanitizer;
        },
        /**
         * Override the default text sanitizing strategy.
         * @param value Custom text sanitizing strategy
         * @throws Error if documents have already been indexed by this search instance
         */
        set: function (value) {
            if (this._initialized) {
                throw Error('ISanitizer cannot be set after initialization');
            }
            this._sanitizer = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Search.prototype, "searchIndex", {
        get: function () {
            return this._searchIndex;
        },
        /**
         * Override the default search index strategy.
         * @param value Custom search index strategy
         * @throws Error if documents have already been indexed
         */
        set: function (value) {
            if (this._initialized) {
                throw Error('ISearchIndex cannot be set after initialization');
            }
            this._searchIndex = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Search.prototype, "tokenizer", {
        get: function () {
            return this._tokenizer;
        },
        /**
         * Override the default text tokenizing strategy.
         * @param value Custom text tokenizing strategy
         * @throws Error if documents have already been indexed by this search instance
         */
        set: function (value) {
            if (this._initialized) {
                throw Error('ITokenizer cannot be set after initialization');
            }
            this._tokenizer = value;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Add a searchable document to the index. Document will automatically be indexed for search.
     * @param document
     */
    Search.prototype.addDocument = function (document) {
        this.addDocuments([document]);
    };
    /**
     * Adds searchable documents to the index. Documents will automatically be indexed for search.
     * @param document
     */
    Search.prototype.addDocuments = function (documents) {
        this._documents = this._documents.concat(documents);
        this.indexDocuments_(documents, this._searchableFields);
    };
    /**
     * Add a new searchable field to the index. Existing documents will automatically be indexed using this new field.
     *
     * @param field Searchable field or field path. Pass a string to index a top-level field and an array of strings for nested fields.
     */
    Search.prototype.addIndex = function (field) {
        this._searchableFields.push(field);
        this.indexDocuments_(this._documents, [field]);
    };
    /**
     * Search all documents for ones matching the specified query text.
     * @param query
     * @returns {Array<Object>}
     */
    Search.prototype.search = function (query) {
        var tokens = this._tokenizer.tokenize(this._sanitizer.sanitize(query));
        return this._searchIndex.search(tokens, this._documents);
    };
    /**
     * @param documents
     * @param _searchableFields Array containing property names and paths (lists of property names) to nested values
     * @private
     */
    Search.prototype.indexDocuments_ = function (documents, _searchableFields) {
        this._initialized = true;
        var indexStrategy = this._indexStrategy;
        var sanitizer = this._sanitizer;
        var searchIndex = this._searchIndex;
        var tokenizer = this._tokenizer;
        var uidFieldName = this._uidFieldName;
        for (var di = 0, numDocuments = documents.length; di < numDocuments; di++) {
            var doc = documents[di];
            var uid;
            if (uidFieldName instanceof Array) {
                uid = (0, getNestedFieldValue_1["default"])(doc, uidFieldName);
            }
            else {
                uid = doc[uidFieldName];
            }
            for (var sfi = 0, numSearchableFields = _searchableFields.length; sfi < numSearchableFields; sfi++) {
                var fieldValue;
                var searchableField = _searchableFields[sfi];
                if (searchableField instanceof Array) {
                    fieldValue = (0, getNestedFieldValue_1["default"])(doc, searchableField);
                }
                else {
                    fieldValue = doc[searchableField];
                }
                if (fieldValue != null && typeof fieldValue !== 'string' && fieldValue.toString) {
                    fieldValue = fieldValue.toString();
                }
                if (typeof fieldValue === 'string') {
                    var fieldTokens = tokenizer.tokenize(sanitizer.sanitize(fieldValue));
                    for (var fti = 0, numFieldValues = fieldTokens.length; fti < numFieldValues; fti++) {
                        var fieldToken = fieldTokens[fti];
                        var expandedTokens = indexStrategy.expandToken(fieldToken);
                        for (var eti = 0, nummExpandedTokens = expandedTokens.length; eti < nummExpandedTokens; eti++) {
                            var expandedToken = expandedTokens[eti];
                            searchIndex.indexDocument(expandedToken, uid, doc);
                        }
                    }
                }
            }
        }
    };
    return Search;
}());
exports.Search = Search;
