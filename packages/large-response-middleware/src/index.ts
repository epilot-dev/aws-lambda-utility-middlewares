import Log from '@dazn/lambda-powertools-logger';
import type middy from '@middy/core';
import type * as Lambda from 'aws-lambda';
import yn from 'yn';

import { uploadFile } from './file-storage-service';

/**
 * Conversion factor from Bytes to MB.
 */
const TO_MB_FACTOR = 1_048_576.0;

/**
 * AWS Lambda payload size limit.
 */
export const LIMIT_REQUEST_SIZE_MB = 6.0;
export const LARGE_RESPONSE_MIME_TYPE = 'application/large-response.vnd+json';
export const HANDLE_LARGE_RESPONSE_HEADER = 'handle-large-response';
export const LARGE_RESPONSE_USER_INFO = `Call the API with the HTTP header 'Accept: ${LARGE_RESPONSE_MIME_TYPE}' to receive the payload through an S3 ref and avoid 413 errors or '${HANDLE_LARGE_RESPONSE_HEADER}: true' to acknowledge you can handle the 413.`;
export const LARGE_RESPONSE_HANDLED_INFO = `'${HANDLE_LARGE_RESPONSE_HEADER}: true' received means client can handle this event. The response is too large and can't be returned to the client.`;

export type FileUploadContext = {
  bucket: string;
  groupId: string;
  content: unknown;
  contentType: string;
  fileName: string;
};

export type CustomErrorMessage = string | ((event: Lambda.APIGatewayProxyEventV2) => string);

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
  customErrorMessage?: CustomErrorMessage;
  groupRequestsBy?: (event: Lambda.APIGatewayProxyEventV2) => string;
}) => {
  return {
    after: async (handlerRequestContext: middy.Request) => {
      const event = handlerRequestContext.event as Lambda.APIGatewayProxyEventV2;
      const requestHeaders = event?.headers || {};
      const response = handlerRequestContext.response as Lambda.APIGatewayProxyStructuredResultV2;

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
        const clientCanHandleLargeResponseBadRequest = Object.entries(requestHeaders).find(
          ([header, v]) => header.toLowerCase() === HANDLE_LARGE_RESPONSE_HEADER && yn(v),
        );
        let $payload_ref = null;

        if (contentLengthMB > thresholdWarnInMB && !clientCanHandleLargeResponseBadRequest) {
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
          } else if (clientCanHandleLargeResponseBadRequest) {
            response.isBase64Encoded = false;
            response.statusCode = 413;

            response.body = JSON.stringify({
              meta: {
                content_length_mb: contentLengthMB.toFixed(2),
              },
              message: getCustomErrorMessage(customErrorMessage || LARGE_RESPONSE_HANDLED_INFO, event),
            });

            response.headers = { ...response.headers, ['content-type']: LARGE_RESPONSE_MIME_TYPE };
            Log.info(
              `Large response detected (limit exceeded). Client signaled that it can handle large responses via 413. Rewriting response with { metadata, message } `,
              {
                contentLength: aproxContentLengthBytes,
                event,
                request: event.requestContext,
                response_size_mb: contentLengthMB.toFixed(2),
              },
            );
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
              message: getCustomErrorMessage(customErrorMessage, event),
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
}): Promise<{ url?: string; filename?: string }> => {
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
      error,
      requestId,
      groupId,
      ...(Log.level === 'DEBUG' && { responseBody: responseBody.slice(0, 250) + ' <redacted>' }),
    });

    return {};
  }
};

function getCustomErrorMessage(
  customErrorMessage: CustomErrorMessage | undefined,
  event: Lambda.APIGatewayProxyEventV2,
) {
  return typeof customErrorMessage === 'function'
    ? customErrorMessage(event)
    : (customErrorMessage ?? LARGE_RESPONSE_USER_INFO);
}
