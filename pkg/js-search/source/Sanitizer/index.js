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
exports.LowerCaseSanitizer = exports.CaseSensitiveSanitizer = void 0;
var CaseSensitiveSanitizer_1 = require("./CaseSensitiveSanitizer");
__createBinding(exports, CaseSensitiveSanitizer_1, "CaseSensitiveSanitizer");
var LowerCaseSanitizer_1 = require("./LowerCaseSanitizer");
__createBinding(exports, LowerCaseSanitizer_1, "LowerCaseSanitizer");
