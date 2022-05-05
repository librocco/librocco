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
exports.UnorderedSearchIndex = exports.TfIdfSearchIndex = void 0;
var TfIdfSearchIndex_1 = require("./TfIdfSearchIndex");
__createBinding(exports, TfIdfSearchIndex_1, "TfIdfSearchIndex");
var UnorderedSearchIndex_1 = require("./UnorderedSearchIndex");
__createBinding(exports, UnorderedSearchIndex_1, "UnorderedSearchIndex");
