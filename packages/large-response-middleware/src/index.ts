import path from 'path';

import Log from '@dazn/lambda-powertools-logger';
import middy from '@middy/core';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { getS3Client } from './s3/s3-client';

/**
 * Conversion factor from Bytes to MB.
 */
const TO_MB_FACTOR = 1_048_576.0;

/**
 * AWS Lambda payload size limit.
 */
export const LIMIT_REQUEST_SIZE_MB = 6.0;
export const LARGE_RESPONSE_MIME_TYPE = 'application/large-response.vnd+json';
const LARGE_RESPONSE_USER_INFO = `Call the API with the HTTP header 'Accept: ${LARGE_RESPONSE_MIME_TYPE}' to receive the payload through an S3 ref and avoid HTTP 500 errors.`;

export type FileUploadContext = {
  bucket: string;
  groupId: string;
  content: unknown;
  contentType: string;
  fileName: string;
};

export const withLargeResponseHandler = ({
  thresholdWarn,
  thresholdError,
  sizeLimitInMB: _sizeLimitInMB,
  outputBucket,
  customErrorMessage,
  groupRequestsBy,
}: {
  thresholdWarn: number;
  thresholdError: number;
  sizeLimitInMB: number;
  outputBucket: string;
  customErrorMessage?: string | ((event: APIGatewayProxyEventV2) => string);
  groupRequestsBy?: (event: APIGatewayProxyEventV2) => string;
}) => {
  return {
    after: async (handlerRequestContext: middy.Request) => {
      const event = handlerRequestContext.event as APIGatewayProxyEventV2;
      const requestHeaders = event?.headers || {};
      const response = handlerRequestContext.response as APIGatewayProxyStructuredResultV2;

      try {
        const groupId = groupRequestsBy?.(handlerRequestContext.event) || 'all';
        const awsRequestId = handlerRequestContext.event.requestContext?.requestId;
        const responseHeadersString = response.headers
          ? Object.entries(response.headers)
              .map(([h, v]) => `${h}: ${v}`)
              .join(' ')
          : '';
        const payload = (handlerRequestContext?.response?.body ?? '') + responseHeadersString;

        const aproxContentLengthBytes = payload.length * 1.0;
        const contentLengthMB = aproxContentLengthBytes > 0 ? aproxContentLengthBytes / TO_MB_FACTOR : 0.0;
        const sizeLimitInMB = (_sizeLimitInMB ?? LIMIT_REQUEST_SIZE_MB) * 1.0;
        const thresholdWarnInMB = (thresholdWarn ?? 0.0) * 1.0 * sizeLimitInMB;
        const thresholdErrorInMB = (thresholdError ?? 0.0) * 1.0 * sizeLimitInMB;

        let $payload_ref = null;

        if (contentLengthMB > thresholdWarnInMB) {
          const { url } = await safeUploadLargeResponse({
            groupId: String(groupId),
            contentType: 'application/json',
            requestId: awsRequestId,
            responseBody: handlerRequestContext?.response?.body,
            outputBucket,
          });

          $payload_ref = url;
        }

        if (contentLengthMB >= thresholdErrorInMB) {
          const clientAcceptsLargeResponseFormat = Object.entries(requestHeaders).find(
            ([header, v]) => header.toLowerCase() === 'accept' && v === LARGE_RESPONSE_MIME_TYPE,
          );

          if (clientAcceptsLargeResponseFormat) {
            response.body = JSON.stringify({
              $payload_ref,
            });

            response.headers = { ...response.headers, ['content-type']: LARGE_RESPONSE_MIME_TYPE };
            Log.info(`Large response detected (limit exceeded). Rewriting response with { $payload_ref } `, {
              contentLength: aproxContentLengthBytes,
              event,
              request: event.requestContext,
              response_size_mb: contentLengthMB.toFixed(2),
              $payload_ref,
            });
          } else {
            Log.error(`Large response detected (limit exceeded). ${LARGE_RESPONSE_USER_INFO}`, {
              contentLength: aproxContentLengthBytes,
              event,
              request: event.requestContext,
              response_size_mb: contentLengthMB.toFixed(2),
              $payload_ref,
            });

            response.isBase64Encoded = false;
            response.statusCode = 413;
            response.body = JSON.stringify({
              message: customErrorMessage
                ? typeof customErrorMessage === 'string'
                  ? customErrorMessage
                  : customErrorMessage(event)
                : LARGE_RESPONSE_USER_INFO,
            });
          }
        } else if (contentLengthMB > thresholdWarnInMB) {
          Log.warn(`Large response detected. ${LARGE_RESPONSE_USER_INFO}`, {
            contentLength: aproxContentLengthBytes,
            event,
            request: event.requestContext,
            response_size_mb: contentLengthMB.toFixed(2),
            $payload_ref,
          });
        }
      } catch (e) {
        Log.warn(
          '[middleware - withLargeResponseHandler - after-hook]: failed to execute, this requires immediate attention.',
          e,
        );
      }
    },
  };
};

export const safeUploadLargeResponse = async ({
  groupId,
  contentType,
  requestId,
  responseBody,
  outputBucket,
}: {
  groupId: string;
  requestId: string;
  contentType: string;
  responseBody: string;
  outputBucket: string;
}): Promise<{ url?: string; outputKey?: string }> => {
  try {
    return await uploadFile({
      bucket: outputBucket,
      groupId,
      content: responseBody,
      contentType: contentType,
      fileName: requestId,
    });
  } catch (error) {
    Log.error('Failed to write large response to s3 bucket', {
      requestId,
      groupId,
      ...(Log.level === 'DEBUG' && { responseBody: responseBody.slice(0, 250) + ' <redacted>' }),
    });

    return {};
  }
};

/**
 * Uploads a file to S3.
 *
 * @returns a presigned URL expiring in 60 minutes for easy access.
 */
export const uploadFile = async (params: FileUploadContext) => {
  const client = await getS3Client();
  const namespace = params.groupId || 'all';
  const date = getFormattedDate();
  const outputKey = `${namespace}/${date}/${encodeURIComponent(params.fileName)}`;

  await client
    .putObject({
      Bucket: params.bucket,
      Key: outputKey,
      ContentType: params.contentType || 'text/plain',
      Body: JSON.stringify(params.content || {}),
      ACL: 'private',
    })
    .promise();

  const url = await client.getSignedUrl('getObject', {
    Expires: 3600,
    Bucket: params.bucket,
    Key: outputKey,
    ResponseContentDisposition: `inline;filename=${path.basename(outputKey)}`,
  });

  return { url, filename: outputKey };
};

function getFormattedDate() {
  const date = new Date();

  return date.toISOString().split('T')[0];
}
