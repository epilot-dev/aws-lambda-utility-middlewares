import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosLargeResponseOptions } from '../types';
import { DEFAULT_OPTIONS, fetchLargePayloadFromS3Ref, getOptions, isDebugEnabled } from './utils';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('isDebugEnabled', () => {
  beforeEach(() => {
    process.env.AXIOS_INTERCEPTOR_LARGE_RESPONSE_DEBUG = '';
  });

  it('should return true if the debug environment variable is set', () => {
    process.env.AXIOS_INTERCEPTOR_LARGE_RESPONSE_DEBUG = 'true';
    expect(isDebugEnabled()).toBe(true);
  });

  it('should return false if the debug environment variable is not set', () => {
    process.env.AXIOS_INTERCEPTOR_LARGE_RESPONSE_DEBUG = '';
    expect(isDebugEnabled()).toBe(false);
  });

  it('should return true if the debug environment variable is set to 1', () => {
    process.env.AXIOS_INTERCEPTOR_LARGE_RESPONSE_DEBUG = '1';
    expect(isDebugEnabled()).toBe(true);
  });

  it('should return true if the manual debug is true', () => {
    expect(isDebugEnabled(true)).toBe(true);
  });

  it('should return false if the manual debug is false', () => {
    expect(isDebugEnabled(false)).toBe(false);
  });
});

describe('fetchLargePayloadFromS3Ref', () => {
  it('should fetch the large payload from the S3 ref', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: JSON.stringify({ payload: 'large-payload' }),
    });

    const largePayload = await fetchLargePayloadFromS3Ref('https://example.com/large-payload');

    expect(largePayload).toEqual({ payload: 'large-payload' });
  });
});

describe('getOptions', () => {
  it('should merge the global options with the config request options', () => {
    const globalOptions = {
      enabled: true,
      debug: false,
      logger: console,
      headerFlag: 'application/json',
      refProperty: '$payload_ref',
      onFetchLargePayloadFromRef: fetchLargePayloadFromS3Ref,
    } satisfies AxiosLargeResponseOptions;

    const customOnFetchLargePayloadFromRef = async (ref: string) => {
      return { payload: `large-payload-from-${ref}` };
    };

    const configRequestOptions = {
      enabled: false,
      onFetchLargePayloadFromRef: customOnFetchLargePayloadFromRef,
    } satisfies AxiosLargeResponseOptions;

    const options = getOptions(configRequestOptions, globalOptions);
    expect(options).toEqual({
      enabled: false,
      debug: false,
      logger: console,
      headerFlag: 'application/json',
      refProperty: '$payload_ref',
      onFetchLargePayloadFromRef: customOnFetchLargePayloadFromRef,
    });
  });

  it('should use the default options', () => {
    const options = getOptions();
    expect(options).toEqual(DEFAULT_OPTIONS);
  });
});
