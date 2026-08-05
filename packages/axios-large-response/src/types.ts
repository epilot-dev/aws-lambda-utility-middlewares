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
 * The only part of an outgoing request the runner wrapper touches. Deliberately loose:
 * `headers` is read and rewritten structurally, so any request shape works - an
 * AxiosRequestConfig, a plain object, or whatever a custom transport uses.
 */
export type RunnerRequest = {
  headers?: unknown;
};

/**
 * The only part of a response the runner wrapper touches.
 */
export type RunnerResponse = {
  headers?: unknown;
  data?: unknown;
};

/**
 * Any transport that turns a request into a response.
 *
 * This intentionally describes nothing about *how* the request is dispatched - HTTP, an
 * AWS Lambda invoke, an in-process call or a test double all satisfy it. Trailing
 * arguments are carried through as an opaque tuple, which is how extra parameters (for
 * example openapi-client-axios' `(operation, context)`) survive the wrapper without this
 * package having to depend on, or name, their types.
 */
export type LargeResponseRunner<
  TRequest extends RunnerRequest = RunnerRequest,
  TResponse extends RunnerResponse = RunnerResponse,
  TRest extends unknown[] = unknown[],
> = {
  runRequest: (request: TRequest, ...rest: TRest) => Promise<TResponse>;
};

export type {
  AxiosLargeResponse,
  AxiosLargeResponseOptions,
  AxiosLargeResponseRequestOptions,
  LargePayloadResponse,
  Logger
};

