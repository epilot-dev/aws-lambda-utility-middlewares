import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosLargeResponseOptions, AxiosLargeResponseRequestOptions } from '../types';
import { DEFAULT_OPTIONS, fetchLargePayloadFromS3Ref, getOptions, isDebugEnabled, usageWarnings } from './utils';

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
    } satisfies AxiosLargeResponseRequestOptions;

    const options = getOptions(configRequestOptions, globalOptions);
    expect(options).toEqual({
      enabled: false,
      debug: false,
      disableWarnings: false,
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

  /**
   * A key present with an undefined value means "not specified". Letting it shadow the
   * default leaves the merged options claiming a type they do not have - an undefined
   * `logger` then throws while reporting a failed ref fetch and masks the original error.
   */
  it('should not let explicitly undefined options shadow the defaults', () => {
    const options = getOptions(undefined, {
      enabled: true,
      headerFlag: undefined,
      logger: undefined,
      refProperty: undefined,
      onFetchLargePayloadFromRef: undefined,
    });

    expect(options.headerFlag).toEqual(DEFAULT_OPTIONS.headerFlag);
    expect(options.logger).toBe(DEFAULT_OPTIONS.logger);
    expect(options.refProperty).toEqual(DEFAULT_OPTIONS.refProperty);
    expect(options.onFetchLargePayloadFromRef).toBe(DEFAULT_OPTIONS.onFetchLargePayloadFromRef);
    expect(options.enabled).toBe(true);
  });

  /**
   * The same applies per request: `enabled: undefined` must not silently disable a
   * globally-enabled client, while an explicit `false` still must.
   */
  it('should not let an undefined per-request option shadow a global one', () => {
    const globalOptions = { enabled: true, refProperty: 'global_ref' } satisfies AxiosLargeResponseOptions;

    expect(getOptions({ enabled: undefined, refProperty: undefined }, globalOptions)).toMatchObject({
      enabled: true,
      refProperty: 'global_ref',
    });

    expect(getOptions({ enabled: false }, globalOptions).enabled).toBe(false);
  });
});

describe('usageWarnings', () => {
  const consoleSpy = vi.spyOn(console, 'warn');

  beforeEach(() => {
    consoleSpy.mockClear();
  });

  it('should not log warnings if the disableWarnings option is true', () => {
    usageWarnings({ disableWarnings: true });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should log warnings if the disableWarnings option is false', () => {
    usageWarnings({ disableWarnings: false });
    expect(consoleSpy).toHaveBeenCalled();
  });
});
