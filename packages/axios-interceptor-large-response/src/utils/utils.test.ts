import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLargePayloadFromS3Ref, isDebugEnabled } from './utils';

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
