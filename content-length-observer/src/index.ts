import Log from "@dazn/lambda-powertools-logger";
import middy from "@middy/core";
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

const TO_MB_FACTOR = 1_048_576.0;

/**
 * AWS LAMBDA payload limit.
 */
const LIMIT_REQUEST_SIZE_MB = 6.0;

interface IWithContentLengthObserver {
  thresholdWarn: number;
  thresholdError: number;
  sizeLimitInMB: number;
}

export const withContentLengthObserver = ({
  thresholdWarn,
  thresholdError,
  sizeLimitInMB: _sizeLimitInMB,
}: IWithContentLengthObserver) => {
  return {
    after: async (handlerRequestContext: middy.Request) => {
      const event = handlerRequestContext.event as APIGatewayProxyEventV2;
      const requestHeaders = event?.headers || {};
      const response =
        handlerRequestContext.response as APIGatewayProxyStructuredResultV2;

      try {
        const awsRequestId =
          handlerRequestContext.event.requestContext.requestId;
        const responseHeadersString = Object.entries(response.headers || {})
          .map(([h, v]) => `${h}: ${v}`)
          .join(" ");
        const payload =
          (handlerRequestContext?.response?.body ?? "") + responseHeadersString;

        const aproxContentLengthBytes = payload.length * 1.0;
        const contentLengthMB =
          aproxContentLengthBytes > 0
            ? aproxContentLengthBytes / TO_MB_FACTOR
            : 0.0;
        const sizeLimitInMB = (_sizeLimitInMB ?? LIMIT_REQUEST_SIZE_MB) * 1.0;
        const thresholdWarnInMB = (thresholdWarn ?? 0.0) * 1.0 * sizeLimitInMB;
        const thresholdErrorInMB =
          (thresholdError ?? 0.0) * 1.0 * sizeLimitInMB;

        if (contentLengthMB >= thresholdErrorInMB) {
          Log.error("Large response detected (limit exceeded)", {
            contentLength: aproxContentLengthBytes,
            event,
            request: event.requestContext,
            response_size_mb: contentLengthMB.toFixed(2),
          });

          const enableLargeResponseRewrite = Object.entries(
            requestHeaders
          ).find(
            ([header, _]) => header.toLowerCase() === "x-accept-large-response"
          );

          if (enableLargeResponseRewrite) {
            response.statusCode = 200;
            response.body = JSON.stringify({
              _large_response_ref: "Testes",
            });
            response.headers = {
              ...response.headers,
              ["x-large-response"]: true,
            };
          }
        } else if (contentLengthMB > thresholdWarnInMB) {
          Log.warn("Large response detected", {
            contentLength: aproxContentLengthBytes,
            event,
            request: event.requestContext,
            response_size_mb: contentLengthMB.toFixed(2),
          });
        }
      } catch (e) {
        Log.warn(
          "middleware:withContentLengthObserver:after-hook:failed to execute, this requires immediate attention.",
          e
        );
      }
    },
  };
};
