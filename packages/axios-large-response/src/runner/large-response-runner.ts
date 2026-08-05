import type { AxiosLargeResponseOptions, LargeResponseRunner, RunnerRequest, RunnerResponse } from '../types';
import { getOptions, isDebugEnabled, resolvePayloadRef, usageWarnings, withAcceptHeader } from '../utils/utils';

/**
 * Adds large-response support to a transport runner, for clients that do not dispatch
 * through an axios instance.
 *
 * Interceptors only run for requests that go through the axios adapter. A client
 * configured with its own runner - `openapi-client-axios`' `registerRunner`, for
 * instance, which is how service-to-service calls over an AWS Lambda invoke are usually
 * wired - bypasses that adapter entirely, so `axiosLargeResponse` never sees those
 * requests and responses over the transport's payload limit fail with a 413. Wrapping the
 * runner closes that gap.
 *
 * The runner is spread into the returned object, so any other members it carries survive.
 * That matters more than it looks: a runner's sibling properties are frequently part of
 * its contract - `openapi-client-axios` invokes a registered runner as
 * `runner.runRequest(request, operation, runner.context)`, and the lambda runner reads the
 * target function name off that `context`. Returning only `runRequest` would silently
 * strip it and leave every request without a target.
 *
 * Unlike the interceptor, `enabled` is resolved once when the runner is wrapped rather
 * than per request, since a runner has no per-request options channel. When disabled the
 * original runner is returned untouched.
 *
 * @example
 * ```ts
 * client.api.registerRunner(
 *   withLargeResponse(getLambdaRunner(lambdaName, context), { enabled: true }),
 * );
 * ```
 */
const withLargeResponse = <
  TRequest extends RunnerRequest,
  TResponse extends RunnerResponse,
  TRest extends unknown[],
  TRunner extends LargeResponseRunner<TRequest, TResponse, TRest>,
>(
  runner: TRunner,
  globalOptions?: AxiosLargeResponseOptions,
): TRunner => {
  // check for warnings
  usageWarnings(globalOptions);

  const { debug, logger, headerFlag, refProperty, onFetchLargePayloadFromRef, enabled, errorPayload } = getOptions(
    undefined,
    globalOptions,
  );

  if (!enabled) {
    return runner;
  }

  const runRequest = async (request: TRequest, ...rest: TRest): Promise<TResponse> => {
    const response = await runner.runRequest(
      { ...request, headers: withAcceptHeader(request.headers, headerFlag) } as TRequest,
      ...rest,
    );

    const payloadRef = resolvePayloadRef(response, headerFlag, refProperty);

    if (!payloadRef) {
      return response;
    }

    if (isDebugEnabled(debug)) {
      logger.debug('[axios-large-response] Fetching large payload from ref url', { ref: payloadRef });
    }

    // narrowed to the one member being replaced: TResponse may declare `data` as a
    // concrete type, and the resolved payload is only known to be unknown
    const mutableResponse = response as RunnerResponse;

    try {
      mutableResponse.data = await onFetchLargePayloadFromRef(payloadRef);
    } catch (error) {
      logger.error('[axios-large-response] Error fetching large payload from ref url', {
        reason: error instanceof Error ? error.message : 'unknown',
      });

      if (errorPayload) {
        mutableResponse.data = errorPayload;

        return response;
      }

      throw error;
    }

    return response;
  };

  // a spread-and-override object literal is not provably assignable to the caller's
  // narrower TRunner, so the shape is asserted here rather than in every consumer
  return { ...runner, runRequest } as TRunner;
};

export { withLargeResponse };
