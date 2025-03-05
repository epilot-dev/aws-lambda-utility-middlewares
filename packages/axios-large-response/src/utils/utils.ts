import axios from 'axios';
import type { AxiosLargeResponseOptions, AxiosLargeResponseRequestOptions } from '../types';

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

export { LARGE_PAYLOAD_MIME_TYPE, NAMESPACE, fetchLargePayloadFromS3Ref, getOptions, isDebugEnabled };

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
