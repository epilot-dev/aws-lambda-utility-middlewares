import axios, { type AxiosInstance } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosLargeResponseOptions } from '../types';
import { LARGE_PAYLOAD_MIME_TYPE, NAMESPACE } from '../utils/utils';
import { axiosLargeResponse } from './axios-interceptor';

/**
 * Test suite for the axiosLargeResponse interceptor.
 */
describe('axiosLargeResponse', () => {
  let axiosInstance: AxiosInstance;
  let globalOptions: Required<AxiosLargeResponseOptions>;

  /**
   * Setup the axios instance and global options.
   * Before each test.
   */
  beforeEach(() => {
    axiosInstance = axios.create();
    globalOptions = {
      enabled: true,
      disableWarnings: false,
      headerFlag: LARGE_PAYLOAD_MIME_TYPE,
      refProperty: '$payloadRef',
      debug: false,
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
      onFetchLargePayloadFromRef: vi.fn().mockResolvedValue({ huge: 'data' }),
      errorPayload: undefined,
    };
  });

  /**
   * Normal responses should pass through unchanged.
   */
  it('should allow normal responses to pass through unchanged', async () => {
    // given
    const requestConfig = {
      method: 'GET',
      url: 'https://api.example.com',
      headers: {},
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
    expect(modifiedRequest.headers.Accept).toEqual(globalOptions.headerFlag);
    expect(result).toEqual(normalResponse);
    expect(globalOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
  });

  /**
   * Warnings should be logged if the disableWarnings option is false (default) and enabled is not explicitly set
   */
  it('should log warnings if the disableWarnings option is false and enabled is not explicitly set', async () => {
    // given
    // when
    axiosLargeResponse(axiosInstance, {
      ...globalOptions,
      enabled: undefined,
    });

    // then
    expect(globalOptions.logger.warn).toHaveBeenCalledWith(
      `[axios-large-response] By default the interceptor is globally disabled (enabled = false). Please make sure you explicitly set the enabled option.
       To mute warnings, set globally the disableWarnings option to true.`,
    );
  });

  /**
   * Warnings should not be logged if the disableWarnings option is true and enabled is not explicitly set
   */
  it('should not log warnings if the disableWarnings option is true and enabled is not explicitly set', async () => {
    // given
    const globalOptionsWithDisableWarnings = {
      ...globalOptions,
      disableWarnings: true,
      enabled: undefined,
    };

    // when
    axiosLargeResponse(axiosInstance, globalOptionsWithDisableWarnings);

    // then
    expect(globalOptions.logger.warn).not.toHaveBeenCalled();
  });

  /**
   * Warnings should not be logged if enabled is explicitly set
   */
  it('should not log warnings if enabled is explicitly set', async () => {
    // given
    const globalOptionsWithDisableWarnings = { ...globalOptions, disableWarnings: false, enabled: false };

    // when
    axiosLargeResponse(axiosInstance, globalOptionsWithDisableWarnings);

    // then
    expect(globalOptions.logger.warn).not.toHaveBeenCalled();
  });

  /**
   * Large responses should be fetched from the ref url and returned with the large payload.
   * Using global options.
   */
  it('should handle large responses appropriately using global options', async () => {
    // given
    const largePayloadUrl = 'https://api.example.com/large-payload';
    const refProperty = globalOptions.refProperty;
    const headerFlag = globalOptions.headerFlag;

    const requestConfig = {
      method: 'GET',
      url: 'https://api.example.com',
      headers: {},
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
      config: requestConfig,
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
    expect(modifiedRequest.headers.Accept).toEqual(headerFlag);
    expect(globalOptions.onFetchLargePayloadFromRef).toHaveBeenCalledWith(largePayloadUrl);
    expect(result).toEqual({
      ...largeResponse,
      data: { huge: 'data' },
    });
  });

  /**
   * Large responses errors should be handled appropriately using global options with error payload.
   */
  it('should handle large responses errors appropriately using global options with error payload', async () => {
    // given
    const largePayloadUrl = 'https://api.example.com/large-payload';
    const refProperty = globalOptions.refProperty;
    const headerFlag = globalOptions.headerFlag;

    const requestConfig = {
      method: 'GET',
      url: 'https://api.example.com',
      headers: {},
    };

    const largeResponse = {
      data: {
        [refProperty]: largePayloadUrl,
      },
      headers: { 'content-type': headerFlag },
      status: 200,
      statusText: 'OK',
      config: requestConfig,
    };

    const globalOptionsWithErrorPayload = {
      ...globalOptions,
      errorPayload: { data: [], hits: 0 },
      onFetchLargePayloadFromRef: vi.fn().mockRejectedValue(new Error('Forced error to test error payload')),
    };

    // when
    const { requestInterceptorId, responseInterceptorId } = axiosLargeResponse(
      axiosInstance,
      globalOptionsWithErrorPayload,
    );

    const { requestInterceptor, responseInterceptor } = getInterceptors(
      axiosInstance,
      requestInterceptorId,
      responseInterceptorId,
    );

    const modifiedRequest = await requestInterceptor(requestConfig);
    const result = await responseInterceptor(largeResponse);

    // then
    expect(modifiedRequest.headers.Accept).toEqual(headerFlag);
    expect(result).toEqual({ ...largeResponse, data: { data: [], hits: 0 } });
    expect(globalOptionsWithErrorPayload.logger.error).toHaveBeenCalledWith(
      '[axios-large-response] Error fetching large payload from ref url',
      {
        reason: 'Forced error to test error payload',
      },
    );
  });

  /**
   * Should throw error if no error payload is provided.
   */
  it('Should throw error if no error payload is provided', async () => {
    // given
    const globalOptionsWithoutErrorPayload = {
      ...globalOptions,
      errorPayload: undefined,
      onFetchLargePayloadFromRef: vi.fn().mockRejectedValue(new Error('Forced error to test error propagation')),
    };

    const largeResponse = {
      data: {
        [globalOptionsWithoutErrorPayload.refProperty]: 'https://api.example.com/large-payload',
      },
      headers: { 'content-type': globalOptionsWithoutErrorPayload.headerFlag },
      status: 200,
      statusText: 'OK',
    };
    // when
    const { requestInterceptorId, responseInterceptorId } = axiosLargeResponse(
      axiosInstance,
      globalOptionsWithoutErrorPayload,
    );

    const { responseInterceptor } = getInterceptors(axiosInstance, requestInterceptorId, responseInterceptorId);

    // then
    await expect(responseInterceptor(largeResponse)).rejects.toThrow('Forced error to test error propagation');

    expect(globalOptionsWithoutErrorPayload.logger.error).toHaveBeenCalledWith(
      '[axios-large-response] Error fetching large payload from ref url',
      {
        reason: 'Forced error to test error propagation',
      },
    );
  });

  /**
   * Large responses should be fetched from the ref url and returned with the large payload.
   * Using more custom global options.
   */
  it('should handle large responses appropriately using more custom global options', async () => {
    // given
    const largePayloadUrl = 'https://api.example.com/large-payload';
    const refProperty = '$customRef';
    const headerFlag = 'application/custom-large-response.vnd+json';

    const requestConfig = {
      method: 'GET',
      url: 'https://api.example.com',
      headers: {},
    };

    const largeResponse = {
      data: {
        [refProperty]: largePayloadUrl,
      },
      headers: {
        'content-type': headerFlag,
      },
      config: requestConfig,
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
    expect(modifiedRequest.headers.Accept).toEqual(headerFlag);
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

  /**
   * Large responses should be fetched from the ref url and returned with the large payload.
   * Using per-request options.
   */
  it('should handle large responses appropriately using per-request options', async () => {
    // given
    const largePayloadUrl = 'https://api.example.com/large-payload';
    const refProperty = '$customRef';
    const headerFlag = 'application/custom-large-response.vnd+json';

    const customGlobalOptions = {
      ...globalOptions,
      enabled: false,
    };

    const requestConfigEnabled = {
      method: 'GET',
      url: 'https://api.example.com',
      [NAMESPACE]: {
        enabled: true,
        headerFlag,
        refProperty,
        debug: true,
        onFetchLargePayloadFromRef: vi.fn().mockResolvedValue({
          superBigData: {
            foo: 'bar',
          },
        }),
      },
    };

    const requestConfigDisabled = {
      method: 'GET',
      url: 'https://api.example.com',
      headers: {},
    };

    const largeResponseDisabled = {
      data: {
        foo: 'bar',
      },
      headers: {
        'content-type': 'application/json',
      },
      config: requestConfigDisabled,
    };

    const largeResponseEnabled = {
      headers: {
        'content-type': headerFlag,
      },
      data: {
        [refProperty]: largePayloadUrl,
      },
      config: requestConfigEnabled,
    };

    // when
    const { requestInterceptorId, responseInterceptorId } = axiosLargeResponse(axiosInstance, customGlobalOptions);

    const { requestInterceptor, responseInterceptor } = getInterceptors(
      axiosInstance,
      requestInterceptorId,
      responseInterceptorId,
    );

    const modifiedRequestEnabled = await requestInterceptor(requestConfigEnabled);
    const modifiedRequestDisabled = await requestInterceptor(requestConfigDisabled);
    const resultDisabled = await responseInterceptor(largeResponseDisabled);
    const resultEnabled = await responseInterceptor(largeResponseEnabled);

    // then
    expect(modifiedRequestDisabled.headers.Accept).not.toEqual(headerFlag);
    expect(modifiedRequestDisabled.headers.Accept).not.toEqual(globalOptions.headerFlag);
    expect(resultDisabled).toEqual(largeResponseDisabled);
    expect(modifiedRequestEnabled.headers.Accept).toEqual(headerFlag);
    expect(resultEnabled).toEqual({
      ...largeResponseEnabled,
      data: {
        superBigData: {
          foo: 'bar',
        },
      },
    });
    expect(requestConfigEnabled[NAMESPACE].onFetchLargePayloadFromRef).toHaveBeenCalledWith(largePayloadUrl);
  });

  /**
   * Large responses should be fetched from the ref url and returned with the large payload.
   * Using merge of per-request and global options.
   */
  it('should handle large responses appropriately using correct merge of per-request and global options', async () => {
    // given
    const largePayloadUrl = 'https://api.example.com/large-payload';

    const customGlobalOptions = {
      ...globalOptions,
      refProperty: '$globalRef',
      debug: true,
    };

    const requestConfig = {
      method: 'GET',
      url: 'https://api.example.com',
      [NAMESPACE]: {
        headerFlag: 'application/request-large-response.vnd+json',
        debug: false,
        onFetchLargePayloadFromRef: vi.fn().mockResolvedValue({
          superBigData: {
            foo: 'bar',
          },
        }),
      },
    };

    const largeResponse = {
      data: {
        [customGlobalOptions.refProperty]: largePayloadUrl,
      },
      headers: {
        'content-type': requestConfig[NAMESPACE].headerFlag,
      },
      config: requestConfig,
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
    expect(modifiedRequest.headers.Accept).toEqual(requestConfig[NAMESPACE].headerFlag);
    expect(customGlobalOptions.logger.debug).not.toHaveBeenCalled();
    expect(globalOptions.logger.debug).not.toHaveBeenCalled();
    expect(globalOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
    expect(requestConfig[NAMESPACE].onFetchLargePayloadFromRef).toHaveBeenCalledWith(largePayloadUrl);
    expect(result).toEqual({
      ...largeResponse,
      data: {
        superBigData: {
          foo: 'bar',
        },
      },
    });
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
