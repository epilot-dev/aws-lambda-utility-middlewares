import type { AxiosLargeResponse, AxiosLargeResponseOptions, LargePayloadResponse } from '../types';
import { NAMESPACE, getOptions, isDebugEnabled } from '../utils/utils';

/**
 * This is the main function that adds the interceptors to the axios instance.
 */
const axiosLargeResponse: AxiosLargeResponse = (axiosInstance, globalOptions) => {
  const requestInterceptorId = axiosInstance.interceptors.request.use((config) => {
    const { headerFlag, enabled } = getOptions(config?.[NAMESPACE], globalOptions);

    if (!enabled) {
      return config;
    }

    config.headers = config.headers || {};
    config.headers.Accept = headerFlag;

    return config;
  });

  const responseInterceptorId = axiosInstance.interceptors.response.use(async (response) => {
    const configRequestOptions = response?.config?.[NAMESPACE];
    const { debug, logger, headerFlag, refProperty, onFetchLargePayloadFromRef, enabled } = getOptions(
      configRequestOptions,
      globalOptions,
    );

    if (!enabled) {
      return response;
    }

    if (
      response.headers['content-type'] === headerFlag &&
      response.data &&
      (response.data as LargePayloadResponse)[refProperty]
    ) {
      if (isDebugEnabled(debug)) {
        logger.debug('[LargeResponseInterceptor] Fetching large payload from ref url', {
          ref: (response.data as LargePayloadResponse)[refProperty],
        });
      }
      try {
        response.data = await onFetchLargePayloadFromRef((response.data as LargePayloadResponse)[refProperty]);
      } catch (error) {
        logger.error('[LargeResponseInterceptor] Error fetching large payload from ref url', {
          reason: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    }
    return response;
  });

  return {
    requestInterceptorId,
    responseInterceptorId,
  };
};

/**
 * This is a workaround to allow the axios-interceptor-large-response options to be used in the axios request config.
 * This is necessary because the axios-interceptor-large-response options are not part of the axios request config.
 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    [NAMESPACE]?: AxiosLargeResponseOptions;
  }
}

export { axiosLargeResponse };
