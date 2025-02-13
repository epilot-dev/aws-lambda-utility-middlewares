import axios from 'axios';
import type { AxiosInterceptorLargeResponseOptions } from '../types';

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

const DEFAULT_OPTIONS: Required<AxiosInterceptorLargeResponseOptions> = {
  debug: false,
  logger: console,
  headerFlag: LARGE_PAYLOAD_MIME_TYPE,
  refUrlProperty: '$payload_ref',
};

/**
 * This function merges the global options with the config request options.
 * If the config request options are not provided, it will use the global options.
 * If the config request options are provided, it will use the config request options.
 */
const getOptions = (
  configRequestOptions?: AxiosInterceptorLargeResponseOptions,
  globalOptions?: AxiosInterceptorLargeResponseOptions,
) => {
  return {
    ...DEFAULT_OPTIONS,
    ...globalOptions,
    ...configRequestOptions,
  };
};

const NAMESPACE = 'axios-interceptor-large-response';

export { fetchLargePayloadFromS3Ref, getOptions, isDebugEnabled, LARGE_PAYLOAD_MIME_TYPE, NAMESPACE };
