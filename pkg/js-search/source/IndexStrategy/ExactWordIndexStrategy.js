"use strict";
exports.__esModule = true;
exports.ExactWordIndexStrategy = void 0;
/**
 * Indexes for exact word matches.
 */
var ExactWordIndexStrategy = /** @class */ (function () {
    function ExactWordIndexStrategy() {
    }
    /**
     * @inheritDocs
     */
    ExactWordIndexStrategy.prototype.expandToken = function (token) {
        return token ? [token] : [];
    };
    return ExactWordIndexStrategy;
}());
exports.ExactWordIndexStrategy = ExactWordIndexStrategy;
;
