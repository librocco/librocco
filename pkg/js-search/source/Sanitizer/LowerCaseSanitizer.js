"use strict";
exports.__esModule = true;
exports.LowerCaseSanitizer = void 0;
/**
 * Sanitizes text by converting to a locale-friendly lower-case version and triming leading and trailing whitespace.
 */
var LowerCaseSanitizer = /** @class */ (function () {
    function LowerCaseSanitizer() {
    }
    /**
     * @inheritDocs
     */
    LowerCaseSanitizer.prototype.sanitize = function (text) {
        return text ? text.toLocaleLowerCase().trim() : '';
    };
    return LowerCaseSanitizer;
}());
exports.LowerCaseSanitizer = LowerCaseSanitizer;
;
