import type {
  AxiosLargeResponseOptions,
  AxiosLargeResponseRequestOptions,
  LargeResponseRunner,
  RunnerRequest,
  RunnerResponse,
  WithObjectRequest,
} from '../types';
import { NAMESPACE, getOptions, resolveLargePayload, usageWarnings, withAcceptHeader } from '../utils/utils';

/**
 * Adds large-response support to a transport runner, for clients that do not dispatch
 * through an axios instance.
 *
 * Interceptors only run for requests that go through the axios adapter. A client
 * configured with its own runner - `openapi-client-axios`' `registerRunner`, for instance -
 * bypasses that adapter entirely, so `axiosLargeResponse` never sees those requests and
 * responses over the transport's payload limit fail with a 413. Wrapping the runner closes
 * that gap. See the README for the full rationale.
 *
 * The returned runner keeps the original's prototype and own properties, so class
 * instances, prototype methods and sibling properties all survive - `openapi-client-axios`
 * invokes a registered runner as `runner.runRequest(request, operation, runner.context)`,
 * and the lambda runner reads the target function name off that `context`. `runRequest`
 * stays bound to the original runner, so a method that reads `this` still works.
 *
 * Every option is resolved per request, `enabled` included, read from a `[NAMESPACE]` key
 * on the request just as the interceptor reads it off the axios config. So the same
 * combinations work on both paths: enable globally and opt individual requests out with
 * `enabled: false`, or leave it disabled and opt the requests that need it in with
 * `enabled: true`. The key is stripped from the forwarded request either way, so it never
 * reaches the transport as payload.
 *
 * @example
 * ```ts
 * client.api.registerRunner(
 *   withLargeResponse(getLambdaRunner(lambdaName, context), { enabled: true }),
 * );
 * ```
 */
const withLargeResponse = <TRunner extends LargeResponseRunner>(
  runner: TRunner & WithObjectRequest<TRunner>,
  globalOptions?: AxiosLargeResponseOptions,
): TRunner => {
  // check for warnings
  usageWarnings(globalOptions);

  // `LargeResponseRunner` accepts any runner shape, so its `runRequest` is not callable as
  // declared; the wrapper handles requests and responses structurally instead. Bound to the
  // runner so a `runRequest` that reads `this` keeps working.
  const dispatch = runner.runRequest.bind(runner) as unknown as (
    request: RunnerRequest,
    ...rest: unknown[]
  ) => Promise<RunnerResponse>;

  const runRequest = async (request: RunnerRequest, ...rest: unknown[]) => {
    // the per-request options channel the interceptor reads off the axios config; stripped
    // from the forwarded request so it never reaches the transport as payload
    const { [NAMESPACE]: requestOptions, ...forwarded } = (request ?? {}) as RunnerRequest & {
      [NAMESPACE]?: AxiosLargeResponseRequestOptions;
    };

    const options = getOptions(requestOptions, globalOptions);

    // resolved from both layers, so a per-request `enabled` decides this one call either
    // way, exactly as it does on the interceptor path
    if (!options.enabled) {
      return dispatch(forwarded, ...rest);
    }

    const response = await dispatch(
      { ...forwarded, headers: withAcceptHeader(forwarded.headers, options.headerFlag) },
      ...rest,
    );

    await resolveLargePayload(response, options);

    return response;
  };

  // own property descriptors and prototype are carried over so class-based runners keep
  // their methods and their identity; `runRequest` is defined as an own property, which
  // shadows a prototype method of the same name.
  //
  // It is overridden in the descriptor map rather than redefined afterwards: a frozen or
  // sealed runner contributes a non-configurable `runRequest` descriptor, and redefining
  // that on the copy throws. Building the map first also leaves the original untouched.
  return Object.create(Object.getPrototypeOf(runner), {
    ...Object.getOwnPropertyDescriptors(runner),
    runRequest: {
      value: runRequest,
      writable: true,
      enumerable: true,
      configurable: true,
    },
  }) as TRunner;
};

export { withLargeResponse };
