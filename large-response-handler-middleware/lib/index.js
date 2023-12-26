var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
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
};
import path from 'path';
import Log from '@dazn/lambda-powertools-logger';
import { getS3Client } from './s3/s3-client';
/**
 * Conversion factor from Bytes to MB.
 */
var TO_MB_FACTOR = 1048576;
/**
 * AWS Lambda payload size limit.
 */
export var LIMIT_REQUEST_SIZE_MB = 6.0;
export var LARGE_RESPONSE_MIME_TYPE = 'application/large-response.vnd+json';
var LARGE_RESPONSE_USER_INFO = "Call the API with the HTTP header 'Accept: ".concat(LARGE_RESPONSE_MIME_TYPE, "' to receive the payload through an S3 ref and avoid HTTP 500 errors.");
export var withLargeResponseHandler = function (_a) {
    var thresholdWarn = _a.thresholdWarn, thresholdError = _a.thresholdError, _sizeLimitInMB = _a.sizeLimitInMB, outputBucket = _a.outputBucket;
    return {
        after: function (handlerRequestContext) { return __awaiter(void 0, void 0, void 0, function () {
            var event, requestHeaders, response, orgId, awsRequestId, responseHeadersString, payload, aproxContentLengthBytes, contentLengthMB, sizeLimitInMB, thresholdWarnInMB, thresholdErrorInMB, $payload_ref, url, clientAcceptsLargeResponseFormat, e_1;
            var _a;
            var _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        event = handlerRequestContext.event;
                        requestHeaders = (event === null || event === void 0 ? void 0 : event.headers) || {};
                        response = handlerRequestContext.response;
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 4, , 5]);
                        orgId = getOrgIdFromContext(handlerRequestContext.event);
                        awsRequestId = (_b = handlerRequestContext.event.requestContext) === null || _b === void 0 ? void 0 : _b.requestId;
                        responseHeadersString = response.headers
                            ? Object.entries(response.headers)
                                .map(function (_a) {
                                var h = _a[0], v = _a[1];
                                return "".concat(h, ": ").concat(v);
                            })
                                .join(' ')
                            : '';
                        payload = ((_d = (_c = handlerRequestContext === null || handlerRequestContext === void 0 ? void 0 : handlerRequestContext.response) === null || _c === void 0 ? void 0 : _c.body) !== null && _d !== void 0 ? _d : '') + responseHeadersString;
                        aproxContentLengthBytes = payload.length * 1.0;
                        contentLengthMB = aproxContentLengthBytes > 0 ? aproxContentLengthBytes / TO_MB_FACTOR : 0.0;
                        sizeLimitInMB = (_sizeLimitInMB !== null && _sizeLimitInMB !== void 0 ? _sizeLimitInMB : LIMIT_REQUEST_SIZE_MB) * 1.0;
                        thresholdWarnInMB = (thresholdWarn !== null && thresholdWarn !== void 0 ? thresholdWarn : 0.0) * 1.0 * sizeLimitInMB;
                        thresholdErrorInMB = (thresholdError !== null && thresholdError !== void 0 ? thresholdError : 0.0) * 1.0 * sizeLimitInMB;
                        $payload_ref = null;
                        if (!(contentLengthMB > thresholdWarnInMB)) return [3 /*break*/, 3];
                        return [4 /*yield*/, safeUploadLargeResponse({
                                orgId: String(orgId),
                                contentType: 'application/json',
                                requestId: awsRequestId,
                                responseBody: (_e = handlerRequestContext === null || handlerRequestContext === void 0 ? void 0 : handlerRequestContext.response) === null || _e === void 0 ? void 0 : _e.body,
                                outputBucket: outputBucket
                            })];
                    case 2:
                        url = (_f.sent()).url;
                        $payload_ref = url;
                        _f.label = 3;
                    case 3:
                        if (contentLengthMB >= thresholdErrorInMB) {
                            clientAcceptsLargeResponseFormat = Object.entries(requestHeaders).find(function (_a) {
                                var header = _a[0], v = _a[1];
                                return header.toLowerCase() === 'accept' && v === LARGE_RESPONSE_MIME_TYPE;
                            });
                            if (clientAcceptsLargeResponseFormat) {
                                response.body = JSON.stringify({
                                    $payload_ref: $payload_ref,
                                });
                                response.headers = __assign(__assign({}, response.headers), (_a = {}, _a['content-type'] = LARGE_RESPONSE_MIME_TYPE, _a));
                                Log.info("Large response detected (limit exceeded). Rewriting response with { $payload_ref } ", {
                                    contentLength: aproxContentLengthBytes,
                                    event: event,
                                    request: event.requestContext,
                                    response_size_mb: contentLengthMB.toFixed(2),
                                    $payload_ref: $payload_ref,
                                });
                            }
                            else {
                                Log.error("Large response detected (limit exceeded). ".concat(LARGE_RESPONSE_USER_INFO), {
                                    contentLength: aproxContentLengthBytes,
                                    event: event,
                                    request: event.requestContext,
                                    response_size_mb: contentLengthMB.toFixed(2),
                                    $payload_ref: $payload_ref,
                                });
                            }
                        }
                        else if (contentLengthMB > thresholdWarnInMB) {
                            Log.warn("Large response detected. ".concat(LARGE_RESPONSE_USER_INFO), {
                                contentLength: aproxContentLengthBytes,
                                event: event,
                                request: event.requestContext,
                                response_size_mb: contentLengthMB.toFixed(2),
                                $payload_ref: $payload_ref,
                            });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        e_1 = _f.sent();
                        Log.warn('[middleware - withLargeResponseHandler - after-hook]: failed to execute, this requires immediate attention.', e_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); },
    };
};
var getOrgIdFromContext = function (event) {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
        return (
        // check authorizer first
        ((_c = (_b = (_a = event === null || event === void 0 ? void 0 : event.requestContext) === null || _a === void 0 ? void 0 : _a.authorizer) === null || _b === void 0 ? void 0 : _b.lambda) === null || _c === void 0 ? void 0 : _c.organizationId) ||
            (
            // check context next
            (_e = Object.entries((_d = event === null || event === void 0 ? void 0 : event.headers) !== null && _d !== void 0 ? _d : {}).find(function (_a) {
                var header = _a[0], _ = _a[1];
                return header.toLowerCase() === 'x-ivy-org-id';
            })) === null || _e === void 0 ? void 0 : _e[1]) ||
            ((_g = Object.entries((_f = event === null || event === void 0 ? void 0 : event.headers) !== null && _f !== void 0 ? _f : {}).find(function (_a) {
                var header = _a[0], _ = _a[1];
                return header.toLowerCase() === 'x-epilot-org-id';
            })) === null || _g === void 0 ? void 0 : _g[1]) ||
            // fallback to unknown
            'unknown');
    }
    catch (e) {
        Log.warn('Failed to get orgId from context', e, event);
        return 'unknown';
    }
};
export var safeUploadLargeResponse = function (_a) {
    var orgId = _a.orgId, contentType = _a.contentType, requestId = _a.requestId, responseBody = _a.responseBody, outputBucket = _a.outputBucket;
    return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, uploadFile({
                            bucket: outputBucket,
                            orgId: orgId,
                            content: responseBody,
                            contentType: contentType,
                            fileName: requestId,
                        })];
                case 1: return [2 /*return*/, _b.sent()];
                case 2:
                    error_1 = _b.sent();
                    Log.error('Failed to write large response to s3 bucket', __assign({ requestId: requestId, orgId: orgId }, (Log.level === 'DEBUG' && { responseBody: responseBody.slice(0, 250) + ' <redacted>' })));
                    return [2 /*return*/, {}];
                case 3: return [2 /*return*/];
            }
        });
    });
};
/**
 * Uploads a file to S3.
 *
 * @returns a presigned URL expiring in 60 minutes for easy access.
 */
export var uploadFile = function (params) { return __awaiter(void 0, void 0, void 0, function () {
    var client, namespace, date, outputKey, url;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getS3Client()];
            case 1:
                client = _a.sent();
                namespace = params.orgId || 'unknown';
                date = getFormattedDate();
                outputKey = "".concat(namespace, "/").concat(date, "/").concat(encodeURIComponent(params.fileName));
                return [4 /*yield*/, client
                        .putObject({
                        Bucket: params.bucket,
                        Key: outputKey,
                        ContentType: params.contentType || 'text/plain',
                        Body: JSON.stringify(params.content || {}),
                        ACL: 'private',
                    })
                        .promise()];
            case 2:
                _a.sent();
                return [4 /*yield*/, client.getSignedUrl('getObject', {
                        Expires: 3600,
                        Bucket: params.bucket,
                        Key: outputKey,
                        ResponseContentDisposition: "inline;filename=".concat(path.basename(outputKey)),
                    })];
            case 3:
                url = _a.sent();
                return [2 /*return*/, { url: url, filename: outputKey }];
        }
    });
}); };
function getFormattedDate() {
    var date = new Date();
    return date.toISOString().split('T')[0];
}
//# sourceMappingURL=index.js.map