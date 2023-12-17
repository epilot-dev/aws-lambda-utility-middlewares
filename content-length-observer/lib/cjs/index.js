'use strict';

require('core-js/modules/esnext.string.replace-all.js');
var Log = require('@dazn/lambda-powertools-logger');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

var TO_MB_FACTOR = 1048576;
/**
 * AWS LAMBDA payload limit.
 */
var LIMIT_REQUEST_SIZE_MB = 6.0;
var withContentLengthObserver = function (_a) {
  var thresholdWarn = _a.thresholdWarn,
    thresholdError = _a.thresholdError,
    _sizeLimitInMB = _a.sizeLimitInMB;
  return {
    after: function (handlerRequestContext) {
      return __awaiter(void 0, void 0, void 0, function () {
        var event, requestHeaders, response, teste, responseHeadersString, payload, aproxContentLengthBytes, contentLengthMB, sizeLimitInMB, thresholdWarnInMB, thresholdErrorInMB, enableLargeResponseRewrite;
        var _a;
        var _b, _c;
        return __generator(this, function (_d) {
          event = handlerRequestContext.event;
          requestHeaders = (event === null || event === void 0 ? void 0 : event.headers) || {};
          response = handlerRequestContext.response;
          teste = "adadadada";
          teste.replaceAll("a", "b");
          try {
            responseHeadersString = Object.entries(response.headers || {}).map(function (_a) {
              var h = _a[0],
                v = _a[1];
              return "".concat(h, ": ").concat(v);
            }).join(" ");
            payload = ((_c = (_b = handlerRequestContext === null || handlerRequestContext === void 0 ? void 0 : handlerRequestContext.response) === null || _b === void 0 ? void 0 : _b.body) !== null && _c !== void 0 ? _c : "") + responseHeadersString;
            aproxContentLengthBytes = payload.length * 1.0;
            contentLengthMB = aproxContentLengthBytes > 0 ? aproxContentLengthBytes / TO_MB_FACTOR : 0.0;
            sizeLimitInMB = (_sizeLimitInMB !== null && _sizeLimitInMB !== void 0 ? _sizeLimitInMB : LIMIT_REQUEST_SIZE_MB) * 1.0;
            thresholdWarnInMB = (thresholdWarn !== null && thresholdWarn !== void 0 ? thresholdWarn : 0.0) * 1.0 * sizeLimitInMB;
            thresholdErrorInMB = (thresholdError !== null && thresholdError !== void 0 ? thresholdError : 0.0) * 1.0 * sizeLimitInMB;
            if (contentLengthMB >= thresholdErrorInMB) {
              Log.error("Large response detected (limit exceeded)", {
                contentLength: aproxContentLengthBytes,
                event: event,
                request: event.requestContext,
                response_size_mb: contentLengthMB.toFixed(2)
              });
              enableLargeResponseRewrite = Object.entries(requestHeaders).find(function (_a) {
                var header = _a[0],
                  _ = _a[1];
                return header.toLowerCase() === "x-accept-large-response";
              });
              if (enableLargeResponseRewrite) {
                response.statusCode = 200;
                response.body = JSON.stringify({
                  _large_response_ref: "Testes"
                });
                response.headers = __assign(__assign({}, response.headers), (_a = {}, _a["x-large-response"] = true, _a));
              }
            } else if (contentLengthMB > thresholdWarnInMB) {
              Log.warn("Large response detected", {
                contentLength: aproxContentLengthBytes,
                event: event,
                request: event.requestContext,
                response_size_mb: contentLengthMB.toFixed(2)
              });
            }
          } catch (e) {
            Log.warn("middleware:withContentLengthObserver:after-hook:failed to execute, this requires immediate attention.", e);
          }
          return [2 /*return*/];
        });
      });
    }
  };
};

module.exports = withContentLengthObserver;
//# sourceMappingURL=index.js.map
