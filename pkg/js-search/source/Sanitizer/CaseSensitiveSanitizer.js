"use strict";
exports.__esModule = true;
exports.CaseSensitiveSanitizer = void 0;
/**
 * Enforces case-sensitive text matches.
 */
var CaseSensitiveSanitizer = /** @class */ (function () {
    function CaseSensitiveSanitizer() {
    }
    /**
     * @inheritDocs
     */
    CaseSensitiveSanitizer.prototype.sanitize = function (text) {
        return text ? text.trim() : '';
    };
    return CaseSensitiveSanitizer;
}());
exports.CaseSensitiveSanitizer = CaseSensitiveSanitizer;
;
