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
exports.PrefixIndexStrategy = exports.ExactWordIndexStrategy = exports.AllSubstringsIndexStrategy = void 0;
var AllSubstringsIndexStrategy_1 = require("./AllSubstringsIndexStrategy");
__createBinding(exports, AllSubstringsIndexStrategy_1, "AllSubstringsIndexStrategy");
var ExactWordIndexStrategy_1 = require("./ExactWordIndexStrategy");
__createBinding(exports, ExactWordIndexStrategy_1, "ExactWordIndexStrategy");
var PrefixIndexStrategy_1 = require("./PrefixIndexStrategy");
__createBinding(exports, PrefixIndexStrategy_1, "PrefixIndexStrategy");
