import axios from 'axios';
import type {
  AxiosLargeResponseOptions,
  AxiosLargeResponseRequestOptions,
  LargePayloadResponse,
  RunnerResponse,
} from '../types';

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
 * A key present with an `undefined` value means "not specified", so it must not shadow the
 * layer beneath it.
 *
 * Plain spreading does let it shadow, which is how `{ headerFlag: process.env.UNSET }` or a
 * spread of a partial config ends up overriding a default with `undefined` - leaving the
 * merged options claiming a type they do not have. The consequences are real: an undefined
 * `logger` throws while reporting a failed ref fetch and masks the original error, an
 * undefined `onFetchLargePayloadFromRef` is not callable, and a per-request
 * `enabled: undefined` silently disables large-response handling for that request.
 */
const definedOnly = <TOptions extends AxiosLargeResponseOptions>(options: TOptions | undefined) =>
  Object.fromEntries(Object.entries(options ?? {}).filter(([, value]) => value !== undefined)) as Partial<TOptions>;

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
    ...definedOnly(globalOptions),
    ...definedOnly(configRequestOptions),
  } satisfies AxiosLargeResponseOptions;
};

const NAMESPACE = 'axios-large-response';

/**
 * Header bags reach us as `unknown`: they may come from axios, from a raw lambda-proxy
 * response, or from a custom transport, so every read narrows through here first.
 *
 * `Object.entries` alone is not enough. A WHATWG `Headers` (fetch/undici) or a `Map` keeps
 * its values off own enumerable properties, so it reads as empty and the envelope silently
 * goes undetected; both expose `entries()` instead. Plain objects and axios' `AxiosHeaders`
 * (own enumerable properties, no `entries()`) still go through `Object.entries`.
 */
const entriesOf = (value: unknown): [string, unknown][] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const bag = value as { entries?: () => Iterable<[unknown, unknown]> };

  return typeof bag.entries === 'function'
    ? Array.from(bag.entries(), ([key, entry]): [string, unknown] => [String(key), entry])
    : Object.entries(value);
};

/**
 * Case-insensitive header lookup. Header casing is not guaranteed across transports:
 * axios lowercases response headers, while a raw lambda-proxy response carries whatever
 * casing the handler produced.
 */
const getHeader = (headers: unknown, name: string): string | undefined => {
  const target = name.toLowerCase();
  const value = entriesOf(headers).find(([key]) => key.toLowerCase() === target)?.[1];

  return typeof value === 'string' ? value : undefined;
};

/**
 * The media type with any parameters stripped, so a `; charset=utf-8` suffix still
 * matches the flag.
 */
const getMediaType = (contentType: string | undefined) => (contentType ?? '').split(';')[0].trim().toLowerCase();

/**
 * Returns the headers with the large-response flag advertised on `Accept`.
 *
 * The middleware matches `Accept` by exact value, so any existing casing variant is
 * dropped first - otherwise two variants travel together and the wrong one may win.
 * The axios request interceptor needs no equivalent: assigning `Accept` on an
 * `AxiosHeaders` instance collapses a pre-existing `accept` for us.
 */
const withAcceptHeader = (headers: unknown, headerFlag: string): Record<string, unknown> => {
  const next: Record<string, unknown> = {};

  for (const [key, value] of entriesOf(headers)) {
    if (key.toLowerCase() !== 'accept') {
      next[key] = value;
    }
  }

  next.Accept = headerFlag;

  return next;
};

/**
 * The envelope body, parsed if the transport left it as an unparsed JSON string.
 *
 * Axios parses response bodies for us, but a runner need not: a lambda-invoke runner that
 * only parses proxy bodies it recognises as JSON hands us the envelope verbatim, and
 * treating that as "not an envelope" would skip the ref fetch in exactly the case this
 * package exists for.
 */
const parseEnvelope = (data: unknown): object | undefined => {
  if (data && typeof data === 'object') {
    return data;
  }

  if (typeof data !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(data);

    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The payload ref when the response is a large-response envelope, `undefined` otherwise.
 *
 * Both sides of the content-type comparison are normalised: the response side because
 * transports append parameters (`; charset=utf-8`), and `headerFlag` because it is a
 * caller-supplied option that may carry parameters of its own or be absent entirely.
 */
const resolvePayloadRef = (response: RunnerResponse, headerFlag: string, refProperty: string): string | undefined => {
  const flagMediaType = getMediaType(headerFlag);

  // an absent flag must never match an absent content-type, which both normalise to ''
  if (!flagMediaType || getMediaType(getHeader(response?.headers, 'content-type')) !== flagMediaType) {
    return undefined;
  }

  const envelope = parseEnvelope(response.data);

  if (!envelope) {
    return undefined;
  }

  const ref = (envelope as LargePayloadResponse)[refProperty];

  return typeof ref === 'string' ? ref : undefined;
};

/**
 * Replaces a large-response envelope's `data` with the payload behind its ref, in place.
 * A no-op for any response that is not an envelope.
 *
 * This is the whole large-response policy - detection, debug logging, and whether a failed
 * fetch degrades to `errorPayload` or throws - so the interceptor and the runner wrapper
 * share it rather than each carrying their own copy that can drift.
 */
const resolveLargePayload = async (response: RunnerResponse, options: Required<AxiosLargeResponseOptions>) => {
  const { debug, logger, headerFlag, refProperty, onFetchLargePayloadFromRef, errorPayload } = options;

  const payloadRef = resolvePayloadRef(response, headerFlag, refProperty);

  if (!payloadRef) {
    return;
  }

  if (isDebugEnabled(debug)) {
    logger.debug('[axios-large-response] Fetching large payload from ref url', { ref: payloadRef });
  }

  try {
    response.data = await onFetchLargePayloadFromRef(payloadRef);
  } catch (error) {
    logger.error('[axios-large-response] Error fetching large payload from ref url', {
      reason: error instanceof Error ? error.message : 'unknown',
    });

    // `undefined` means "not configured"; any other value, falsy ones included, is a
    // deliberate degraded payload
    if (errorPayload === undefined) {
      throw error;
    }

    response.data = errorPayload;
  }
};

export {
  LARGE_PAYLOAD_MIME_TYPE,
  NAMESPACE,
  fetchLargePayloadFromS3Ref,
  getOptions,
  isDebugEnabled,
  resolveLargePayload,
  withAcceptHeader,
};

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
