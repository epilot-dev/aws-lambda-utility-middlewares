import axios from 'axios';
import type { AxiosLargeResponseOptions, AxiosLargeResponseRequestOptions, RunnerResponse } from '../types';

const DEBUG_ENV_VAR = 'AXIOS_INTERCEPTOR_LARGE_RESPONSE_DEBUG';

const LARGE_PAYLOAD_MIME_TYPE = 'application/large-response.vnd+json';

const fetchLargePayloadFromS3Ref = async (payloadRef: string) => {
  const escapedJsonResponse = await axios.get(payloadRef);
  return JSON.parse(escapedJsonResponse.data);
};

const isDebugEnabled = (manualDebug?: boolean) => {
  if (manualDebug !== undefined) {
    return manualDebug;
  }
  const envVarValue = process.env[DEBUG_ENV_VAR];
  return envVarValue === 'true' || envVarValue === '1';
};

export const DEFAULT_OPTIONS: Required<AxiosLargeResponseOptions> = {
  enabled: false, // disabled by default
  debug: false,
  logger: console,
  headerFlag: LARGE_PAYLOAD_MIME_TYPE,
  refProperty: '$payload_ref',
  onFetchLargePayloadFromRef: fetchLargePayloadFromS3Ref,
  errorPayload: undefined,
  disableWarnings: false,
};

/**
 * This function merges the global options with the config request options.
 * If the config request options are not provided, it will use the global options.
 * If the config request options are provided, it will use the config request options.
 */
const getOptions = (
  configRequestOptions?: AxiosLargeResponseRequestOptions,
  globalOptions?: AxiosLargeResponseOptions,
) => {
  return {
    ...DEFAULT_OPTIONS,
    ...globalOptions,
    ...configRequestOptions,
  } satisfies AxiosLargeResponseOptions;
};

const NAMESPACE = 'axios-large-response';

/**
 * Case-insensitive header lookup. Header casing is not guaranteed across transports:
 * axios lowercases response headers, while a raw lambda-proxy response carries whatever
 * casing the handler produced.
 */
export const getHeader = (headers: unknown, name: string): string | undefined => {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const target = name.toLowerCase();

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() === target) {
      return typeof value === 'string' ? value : undefined;
    }
  }

  return undefined;
};

/**
 * The media type with any parameters stripped, so a `; charset=utf-8` suffix still
 * matches the flag.
 */
export const getMediaType = (contentType: string | undefined) => (contentType ?? '').split(';')[0].trim().toLowerCase();

/**
 * Returns the headers with the large-response flag advertised on `Accept`.
 *
 * The middleware matches `Accept` by exact value, so any existing casing variant is
 * dropped first - otherwise two variants travel together and the wrong one may win.
 */
export const withAcceptHeader = (headers: unknown, headerFlag: string): Record<string, unknown> => {
  const next: Record<string, unknown> = {};

  if (headers && typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
      if (key.toLowerCase() !== 'accept') {
        next[key] = value;
      }
    }
  }

  next.Accept = headerFlag;

  return next;
};

/**
 * The payload ref when the response is a large-response envelope, `undefined` otherwise.
 * Shared by the interceptor and the runner wrapper so both agree on what counts as one.
 */
export const resolvePayloadRef = (response: unknown, headerFlag: string, refProperty: string): string | undefined => {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const { headers, data } = response as RunnerResponse;

  if (getMediaType(getHeader(headers, 'content-type')) !== getMediaType(headerFlag)) {
    return undefined;
  }

  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const ref = (data as Record<string, unknown>)[refProperty];

  return typeof ref === 'string' ? ref : undefined;
};

export { fetchLargePayloadFromS3Ref, getOptions, isDebugEnabled, LARGE_PAYLOAD_MIME_TYPE, NAMESPACE };

export const usageWarnings = (options: AxiosLargeResponseOptions | undefined) => {
  if (options?.disableWarnings) {
    return;
  }

  if (typeof options?.enabled !== 'boolean') {
    const logger = options?.logger || console;

    logger.warn(
      `[axios-large-response] By default the interceptor is globally disabled (enabled = false). Please make sure you explicitly set the enabled option.
       To mute warnings, set globally the disableWarnings option to true.`,
    );
  }

  // insert here other warnings when needed
};
