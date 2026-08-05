import type { AxiosLargeResponse, AxiosLargeResponseRequestOptions } from '../types';
import { NAMESPACE, getOptions, resolveLargePayload, usageWarnings } from '../utils/utils';

/**
 * This is the main function that adds the interceptors to the axios instance.
 */
const axiosLargeResponse: AxiosLargeResponse = (axiosInstance, globalOptions) => {
  // check for warnings
  usageWarnings(globalOptions);

  // request interceptor
  const requestInterceptorId = axiosInstance.interceptors.request.use((config) => {
    const { headerFlag, enabled } = getOptions(config?.[NAMESPACE], globalOptions);

    if (!enabled) {
      return config;
    }

    config.headers = config.headers || {};
    config.headers.Accept = headerFlag;

    return config;
  });

  // response interceptor
  const responseInterceptorId = axiosInstance.interceptors.response.use(async (response) => {
    const options = getOptions(response?.config?.[NAMESPACE], globalOptions);

    if (!options.enabled) {
      return response;
    }

    await resolveLargePayload(response, options);

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
    [NAMESPACE]?: AxiosLargeResponseRequestOptions;
  }
}

export { axiosLargeResponse };
