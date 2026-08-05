import type { AxiosInstance, AxiosStatic } from 'axios';

type LargePayloadResponse = {
  [refUrlProperty: string]: string;
};

type Logger = {
  debug: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
};

type AxiosLargeResponseOptions = BaseAxiosLargeResponseOptions & {
  disableWarnings?: boolean;
};

type AxiosLargeResponseRequestOptions = BaseAxiosLargeResponseOptions;

type BaseAxiosLargeResponseOptions = {
  enabled?: boolean;
  debug?: boolean;
  logger?: Logger;
  headerFlag?: string;
  refProperty?: string;
  onFetchLargePayloadFromRef?: (ref: string) => Promise<unknown>;
  errorPayload?: unknown;
};

type AxiosLargeResponse = (
  axiosInstance: AxiosInstance | AxiosStatic,
  axiosLargeResponseOptions?: AxiosLargeResponseOptions,
) => {
  requestInterceptorId: number;
  responseInterceptorId: number;
};

/**
 * The only part of an outgoing request the runner wrapper touches.
 */
type RunnerRequest = {
  headers?: unknown;
};

/**
 * The only part of a response the runner wrapper touches.
 */
type RunnerResponse = {
  headers?: unknown;
  data?: unknown;
};

/**
 * Any transport that turns a request into a response.
 *
 * This intentionally describes nothing about *how* the request is dispatched - HTTP, an
 * AWS Lambda invoke, an in-process call or a test double all satisfy it. `never` parameters
 * are what make that true: a parameter list is checked contravariantly, so naming a request
 * type here (even one as loose as `{ headers?: unknown }`) would *reject* every runner that
 * declares a narrower one - including the `AxiosRequestConfig`-typed runners this wrapper
 * exists to support.
 */
type LargeResponseRunner = {
  runRequest: (...args: never[]) => Promise<unknown>;
};

/**
 * `TRunner` unless its request is a primitive, in which case an error-shaped type.
 *
 * `LargeResponseRunner` has to accept any parameter list (see above), which on its own also
 * admits runners the wrapper cannot drive - it rewrites headers via `{ ...request }`, so a
 * `runRequest(url: string, init)` would receive a spread of the string's indices instead of
 * a URL. Inferring the request position separately restores that guarantee without putting
 * a named type in the contravariant slot.
 *
 * The test is "is it a primitive", not "does it extend object", so that a runner declaring
 * a deliberately permissive request (`unknown`, `any`) is still accepted - only shapes that
 * genuinely cannot be spread are turned away.
 */
type WithObjectRequest<TRunner> = TRunner extends { runRequest: (request: infer TRequest, ...rest: never[]) => unknown }
  ? TRequest extends string | number | boolean | bigint | symbol | null | undefined
    ? { runRequest: 'withLargeResponse requires a runner whose first argument is an object' }
    : TRunner
  : TRunner;

export type {
  AxiosLargeResponse,
  AxiosLargeResponseOptions,
  AxiosLargeResponseRequestOptions,
  LargePayloadResponse,
  LargeResponseRunner,
  Logger,
  RunnerRequest,
  RunnerResponse,
  WithObjectRequest,
};
