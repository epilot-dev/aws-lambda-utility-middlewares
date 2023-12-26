import middy from '@middy/core';
/**
 * AWS Lambda payload size limit.
 */
export declare const LIMIT_REQUEST_SIZE_MB = 6;
export declare const LARGE_RESPONSE_MIME_TYPE = "application/large-response.vnd+json";
export type FileUploadContext = {
    bucket: string;
    orgId: string;
    content: unknown;
    contentType: string;
    fileName: string;
};
export declare const withLargeResponseHandler: ({ thresholdWarn, thresholdError, sizeLimitInMB: _sizeLimitInMB, outputBucket, }: {
    thresholdWarn: number;
    thresholdError: number;
    sizeLimitInMB: number;
    outputBucket: string;
}) => {
    after: (handlerRequestContext: middy.Request) => Promise<void>;
};
export declare const safeUploadLargeResponse: ({ orgId, contentType, requestId, responseBody, outputBucket }: {
    orgId: string;
    requestId: string;
    contentType: string;
    responseBody: string;
    outputBucket: string;
}) => Promise<{
    url?: string;
    outputKey?: string;
}>;
/**
 * Uploads a file to S3.
 *
 * @returns a presigned URL expiring in 60 minutes for easy access.
 */
export declare const uploadFile: (params: FileUploadContext) => Promise<{
    url: string;
    filename: string;
}>;
