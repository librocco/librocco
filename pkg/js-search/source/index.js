"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
exports.__esModule = true;
exports.TokenHighlighter = exports.StopWordsMap = exports.Search = exports.StopWordsTokenizer = exports.StemmingTokenizer = exports.SimpleTokenizer = exports.UnorderedSearchIndex = exports.TfIdfSearchIndex = exports.LowerCaseSanitizer = exports.CaseSensitiveSanitizer = exports.PrefixIndexStrategy = exports.ExactWordIndexStrategy = exports.AllSubstringsIndexStrategy = void 0;
var index_1 = require("./IndexStrategy/index");
__createBinding(exports, index_1, "AllSubstringsIndexStrategy");
__createBinding(exports, index_1, "ExactWordIndexStrategy");
__createBinding(exports, index_1, "PrefixIndexStrategy");
var index_2 = require("./Sanitizer/index");
__createBinding(exports, index_2, "CaseSensitiveSanitizer");
__createBinding(exports, index_2, "LowerCaseSanitizer");
var index_3 = require("./SearchIndex/index");
__createBinding(exports, index_3, "TfIdfSearchIndex");
__createBinding(exports, index_3, "UnorderedSearchIndex");
var index_4 = require("./Tokenizer/index");
__createBinding(exports, index_4, "SimpleTokenizer");
__createBinding(exports, index_4, "StemmingTokenizer");
__createBinding(exports, index_4, "StopWordsTokenizer");
var Search_1 = require("./Search");
__createBinding(exports, Search_1, "Search");
var StopWordsMap_1 = require("./StopWordsMap");
__createBinding(exports, StopWordsMap_1, "StopWordsMap");
var TokenHighlighter_1 = require("./TokenHighlighter");
__createBinding(exports, TokenHighlighter_1, "TokenHighlighter");
