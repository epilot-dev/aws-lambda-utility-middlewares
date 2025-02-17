import axios, { type AxiosInstance } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosLargeResponseOptions } from '../types';
import { LARGE_PAYLOAD_MIME_TYPE } from '../utils/utils';
import { axiosLargeResponse } from './axios-interceptor';

describe('axiosInterceptorLargeResponse', () => {
  let axiosInstance: AxiosInstance;
  let globalOptions: Required<AxiosLargeResponseOptions>;

  beforeEach(() => {
    axiosInstance = axios.create();
    globalOptions = {
      enabled: true,
      headerFlag: LARGE_PAYLOAD_MIME_TYPE,
      refProperty: '$payloadRef',
      debug: false,
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
      },
      onFetchLargePayloadFromRef: vi.fn().mockResolvedValue({ huge: 'data' }),
    };
  });

  it('should allow normal responses to pass through unchanged', async () => {
    // given
    const requestConfig = {
      method: 'GET',
      url: 'https://api.example.com',
    };

    const normalResponse = {
      data: { foo: 'bar' },
      headers: { 'content-type': 'application/json' },
      config: requestConfig,
      status: 200,
      statusText: 'OK',
    };

    // when
    const { requestInterceptorId, responseInterceptorId } = axiosLargeResponse(axiosInstance, globalOptions);

    const { requestInterceptor, responseInterceptor } = getInterceptors(
      axiosInstance,
      requestInterceptorId,
      responseInterceptorId,
    );

    const modifiedRequest = await requestInterceptor(requestConfig);
    const result = await responseInterceptor(normalResponse);

    // then
    expect(globalOptions.logger.debug).not.toHaveBeenCalled();
    expect(modifiedRequest).toEqual(requestConfig);
    expect(result).toEqual(normalResponse);
    expect(globalOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
  });

  it('should handle large responses appropriately using global options', async () => {
    // given
    const largePayloadUrl = 'https://api.example.com/large-payload';
    const refProperty = globalOptions.refProperty;
    const headerFlag = globalOptions.headerFlag;

    const requestConfig = {
      method: 'GET',
      url: 'https://api.example.com',
    };

    const largeResponse = {
      data: {
        [refProperty]: largePayloadUrl,
      },
      headers: {
        'content-type': headerFlag,
      },
      status: 200,
      statusText: 'OK',
    };

    // when
    const { requestInterceptorId, responseInterceptorId } = axiosLargeResponse(axiosInstance, globalOptions);

    const { requestInterceptor, responseInterceptor } = getInterceptors(
      axiosInstance,
      requestInterceptorId,
      responseInterceptorId,
    );

    const modifiedRequest = await requestInterceptor(requestConfig);
    const result = await responseInterceptor(largeResponse);

    // then
    expect(modifiedRequest).toEqual(requestConfig);
    expect(globalOptions.onFetchLargePayloadFromRef).toHaveBeenCalledWith(largePayloadUrl);
    expect(result).toEqual({
      ...largeResponse,
      data: { huge: 'data' },
    });
  });
  it('should handle large responses appropriately using custom global options', async () => {
    // given
    const largePayloadUrl = 'https://api.example.com/large-payload';
    const refProperty = '$customRef';
    const headerFlag = 'application/custom-large-response.vnd+json';

    const requestConfig = {
      method: 'GET',
      url: 'https://api.example.com',
    };

    const largeResponse = {
      data: {
        [refProperty]: largePayloadUrl,
      },
      headers: {
        'content-type': headerFlag,
      },
    };

    const customGlobalOptions = {
      ...globalOptions,
      headerFlag,
      refProperty,
      debug: true,
      onFetchLargePayloadFromRef: vi.fn().mockResolvedValue({
        superBigData: {
          foo: 'bar',
        },
      }),
    };

    // when
    const { requestInterceptorId, responseInterceptorId } = axiosLargeResponse(axiosInstance, customGlobalOptions);

    const { requestInterceptor, responseInterceptor } = getInterceptors(
      axiosInstance,
      requestInterceptorId,
      responseInterceptorId,
    );

    const modifiedRequest = await requestInterceptor(requestConfig);
    const result = await responseInterceptor(largeResponse);

    // then
    expect(modifiedRequest).toEqual(requestConfig);
    expect(customGlobalOptions.logger.debug).toHaveBeenCalledWith(
      '[axios-large-response] Fetching large payload from ref url',
      {
        ref: largePayloadUrl,
      },
    );
    expect(customGlobalOptions.onFetchLargePayloadFromRef).toHaveBeenCalledWith(largePayloadUrl);
    expect(result).toEqual({
      ...largeResponse,
      data: {
        superBigData: {
          foo: 'bar',
        },
      },
    });
  });
  it('should handle large responses appropriately using per-request options', async () => {
    // given
    // when
    // then
  });
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
