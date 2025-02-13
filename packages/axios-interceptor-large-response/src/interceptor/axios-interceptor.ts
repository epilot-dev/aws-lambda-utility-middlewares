import type {
  AxiosInterceptorLargeResponse,
  AxiosInterceptorLargeResponseOptions,
  LargePayloadResponse,
} from '../types';
import { NAMESPACE, fetchLargePayloadFromS3Ref, getOptions, isDebugEnabled } from '../utils/utils';

/**
 * This is the main function that adds the interceptors to the axios instance.
 */
const axiosInterceptorLargeResponse: AxiosInterceptorLargeResponse = (axiosInstance, globalOptions) => {
  const requestInterceptorId = axiosInstance.interceptors.request.use((config) => {
    const { headerFlag } = getOptions(config?.[NAMESPACE], globalOptions);

    config.headers = config.headers || {};
    config.headers.Accept = headerFlag;

    return config;
  });

  const responseInterceptorId = axiosInstance.interceptors.response.use(async (response) => {
    const configRequestOptions = response?.config?.[NAMESPACE];
    const { debug, logger, headerFlag, refUrlProperty } = getOptions(configRequestOptions, globalOptions);

    if (
      response.headers['content-type'] === headerFlag &&
      response.data &&
      (response.data as LargePayloadResponse)[refUrlProperty]
    ) {
      if (isDebugEnabled(debug)) {
        logger.debug('[LargeResponseInterceptor] Fetching large payload from ref url', {
          refUrl: (response.data as LargePayloadResponse)[refUrlProperty],
        });
      }
      try {
        response.data = await fetchLargePayloadFromS3Ref((response.data as LargePayloadResponse)[refUrlProperty]);
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
    [NAMESPACE]?: AxiosInterceptorLargeResponseOptions;
  }
}

export { axiosInterceptorLargeResponse };
