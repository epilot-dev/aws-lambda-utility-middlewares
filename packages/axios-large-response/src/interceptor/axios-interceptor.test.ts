import axios, { type AxiosInstance } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosLargeResponseOptions } from '../types';
import { axiosLargeResponse } from './axios-interceptor';

describe('axiosInterceptorLargeResponse', () => {
  let axiosInstance: AxiosInstance;
  let globalOptions: AxiosLargeResponseOptions;

  beforeEach(() => {
    axiosInstance = axios.create();
    globalOptions = {
      enabled: true,
      headerFlag: 'application/ref+json',
      refProperty: 'ref',
      debug: false,
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
      },
      onFetchLargePayloadFromRef: vi.fn(),
    };
  });

  // biome-ignore lint/suspicious/noFocusedTests: <explanation>
  it.only('should allow normal responses to pass through unchanged', async () => {
    // Mock request config
    const requestConfig = {
      headers: {},
      method: 'GET',
      url: 'https://api.example.com',
    };

    // Mock response
    const normalResponse = {
      data: { foo: 'bar' },
      headers: { 'content-type': 'application/json' },
      config: requestConfig,
      status: 200,
      statusText: 'OK',
    };

    const { requestInterceptorId, responseInterceptorId } = axiosLargeResponse(axiosInstance, globalOptions);

    const { requestInterceptor, responseInterceptor } = getInterceptors(
      axiosInstance,
      requestInterceptorId,
      responseInterceptorId,
    );

    const modifiedConfig = await requestInterceptor(requestConfig);
    expect(modifiedConfig.headers.Accept).toBe(globalOptions.headerFlag);

    const result = await responseInterceptor(normalResponse);
    expect(result).toEqual(normalResponse);

    expect(globalOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
  });

  // it('should handle large responses appropriately', async () => {
  //   const { responseInterceptorId } = axiosLargeResponse(axiosInstance, globalOptions);
  //   const largePayloadUrl = 'https://api.example.com/large-payload';
  //   const largePayloadData = { huge: 'data' };

  //   const largeResponse = {
  //     data: { ref: largePayloadUrl } as LargePayloadResponse,
  //     headers: { 'content-type': 'application/ref+json' },
  //     config: {},
  //   };

  //   globalOptions.onFetchLargePayloadFromRef.mockResolvedValueOnce(largePayloadData);

  //   const interceptor = axiosInstance.interceptors.response.handlers[responseInterceptorId].fulfilled;
  //   const result = await interceptor(largeResponse);

  //   expect(result.data).toEqual(largePayloadData);
  //   expect(globalOptions.onFetchLargePayloadFromRef).toHaveBeenCalledWith(largePayloadUrl);
  // });

  // it('should respect the configured size threshold when disabled', async () => {
  //   const localOptions: AxiosLargeResponseOptions = {
  //     ...globalOptions,
  //     enabled: false,
  //   };

  //   const { responseInterceptorId } = axiosLargeResponse(axiosInstance, localOptions);
  //   const largeResponse = {
  //     data: { ref: 'some-url' } as LargePayloadResponse,
  //     headers: { 'content-type': 'application/ref+json' },
  //     config: {},
  //   };

  //   const interceptor = axiosInstance.interceptors.response.handlers[responseInterceptorId].fulfilled;
  //   const result = await interceptor(largeResponse);

  //   expect(result).toEqual(largeResponse);
  //   expect(localOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
  // });

  // it('should handle errors gracefully', async () => {
  //   const { responseInterceptorId } = axiosLargeResponse(axiosInstance, globalOptions);
  //   const error = new Error('Failed to fetch');
  //   const largeResponse = {
  //     data: { ref: 'error-url' } as LargePayloadResponse,
  //     headers: { 'content-type': 'application/ref+json' },
  //     config: {},
  //   };

  //   globalOptions.onFetchLargePayloadFromRef.mockRejectedValueOnce(error);

  //   const interceptor = axiosInstance.interceptors.response.handlers[responseInterceptorId].fulfilled;

  //   await expect(interceptor(largeResponse)).rejects.toThrow('Failed to fetch');
  //   expect(globalOptions.logger.error).toHaveBeenCalledWith(
  //     '[LargeResponseInterceptor] Error fetching large payload from ref url',
  //     { reason: 'Failed to fetch' },
  //   );
  // });

  // it('should set correct request headers', async () => {
  //   const { requestInterceptorId } = axiosLargeResponse(axiosInstance, globalOptions);
  //   const config = {
  //     headers: {},
  //   };

  //   const interceptor = axiosInstance.interceptors.request.handlers[requestInterceptorId].fulfilled;
  //   const result = await interceptor(config);

  //   expect(result.headers.Accept).toBe(globalOptions.headerFlag);
  // });

  // it('should respect per-request options', async () => {
  //   const { responseInterceptorId } = axiosLargeResponse(axiosInstance, globalOptions);
  //   const customRefProperty = 'customRef';
  //   const largePayloadUrl = 'https://api.example.com/large-payload';

  //   const largeResponse = {
  //     data: { [customRefProperty]: largePayloadUrl },
  //     headers: { 'content-type': 'application/ref+json' },
  //     config: {
  //       [NAMESPACE]: {
  //         refProperty: customRefProperty,
  //       },
  //     },
  //   };

  //   const interceptor = axiosInstance.interceptors.response.handlers[responseInterceptorId].fulfilled;
  //   await interceptor(largeResponse);

  //   expect(globalOptions.onFetchLargePayloadFromRef).toHaveBeenCalledWith(largePayloadUrl);
  // });
});

const getInterceptors = (axiosInstance: AxiosInstance, requestId: number, responseId: number) => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const requestInterceptor = (axiosInstance.interceptors.request as any).handlers[requestId].fulfilled;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const responseInterceptor = (axiosInstance.interceptors.response as any).handlers[responseId].fulfilled;

  return {
    requestInterceptor,
    responseInterceptor,
  };
};
