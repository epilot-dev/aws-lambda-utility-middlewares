import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosLargeResponseOptions } from '../types';
import { LARGE_PAYLOAD_MIME_TYPE } from '../utils/utils';
import { withLargeResponse } from './large-response-runner';

/**
 * Test suite for the withLargeResponse runner wrapper.
 *
 * The runner is deliberately described structurally, so these tests use a plain object
 * rather than any transport-specific runner - no AWS Lambda or openapi-client-axios
 * types are needed to exercise the contract.
 */
describe('withLargeResponse', () => {
  let runRequest: ReturnType<typeof vi.fn>;
  let globalOptions: Required<AxiosLargeResponseOptions>;

  /**
   * Setup a bare runner and global options. Before each test.
   */
  beforeEach(() => {
    runRequest = vi.fn().mockResolvedValue({ status: 200, headers: {}, data: { foo: 'bar' } });
    globalOptions = {
      enabled: true,
      disableWarnings: true,
      headerFlag: LARGE_PAYLOAD_MIME_TYPE,
      refProperty: '$payload_ref',
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
   * The runner's other members are part of its contract and must survive wrapping.
   *
   * openapi-client-axios invokes a registered runner as
   * `runner.runRequest(request, operation, runner.context)`, and the lambda runner reads
   * the target function name off that context. A wrapper returning only `runRequest`
   * would strip it and leave every request without a target.
   */
  it('should preserve other members of the wrapped runner', () => {
    // given
    const context = { functionName: 'my-lambda' };

    // when
    const wrapped = withLargeResponse({ runRequest, context }, globalOptions);

    // then
    expect(wrapped.context).toEqual(context);
  });

  /**
   * The middleware matches Accept by exact value.
   */
  it('should advertise the flag on Accept and drop any existing casing variant', async () => {
    // given
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    await wrapped.runRequest({ headers: { accept: 'application/json', authorization: 'Bearer x' } });

    // then
    const forwarded = runRequest.mock.calls[0][0];

    expect(forwarded.headers.Accept).toEqual(LARGE_PAYLOAD_MIME_TYPE);
    expect(forwarded.headers.accept).toBeUndefined();
    expect(forwarded.headers.authorization).toEqual('Bearer x');
  });

  /**
   * Trailing arguments belong to the wrapped runner and must pass through untouched.
   */
  it('should forward trailing arguments to the wrapped runner', async () => {
    // given
    const wrapped = withLargeResponse({ runRequest }, globalOptions);
    const operation = { operationId: 'getThings' };
    const context = { functionName: 'my-lambda' };

    // when
    await wrapped.runRequest({ headers: {} }, operation, context);

    // then
    expect(runRequest.mock.calls[0][1]).toBe(operation);
    expect(runRequest.mock.calls[0][2]).toBe(context);
  });

  /**
   * Normal responses should pass through unchanged.
   */
  it('should allow normal responses to pass through unchanged', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { foo: 'bar' },
    });
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({ headers: {} });

    // then
    expect(response.data).toEqual({ foo: 'bar' });
    expect(globalOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
  });

  /**
   * Large responses should be resolved from the ref.
   */
  it('should resolve a large response from the payload ref', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({ headers: {} });

    // then
    expect(globalOptions.onFetchLargePayloadFromRef).toHaveBeenCalledWith('https://bucket.s3.amazonaws.com/ref');
    expect(response.data).toEqual({ huge: 'data' });
  });

  /**
   * Response header casing is not guaranteed across transports: a raw lambda-proxy
   * response carries whatever casing the handler produced.
   */
  it('should detect the flag regardless of response header casing', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'Content-Type': LARGE_PAYLOAD_MIME_TYPE },
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({ headers: {} });

    // then
    expect(response.data).toEqual({ huge: 'data' });
  });

  /**
   * A charset parameter on the content type must not stop the ref being resolved.
   */
  it('should detect the flag when the content type carries parameters', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': `${LARGE_PAYLOAD_MIME_TYPE}; charset=utf-8` },
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({ headers: {} });

    // then
    expect(response.data).toEqual({ huge: 'data' });
  });

  /**
   * An envelope-looking response without a ref is not a large response.
   */
  it('should leave the response alone when the ref is missing', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
      data: { message: 'too large, but no ref' },
    });
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({ headers: {} });

    // then
    expect(globalOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
    expect(response.data).toEqual({ message: 'too large, but no ref' });
  });

  /**
   * A failed ref fetch propagates, unless an errorPayload is configured.
   */
  it('should propagate a failed ref fetch', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const error = new Error('s3 is having a day');
    globalOptions.onFetchLargePayloadFromRef = vi.fn().mockRejectedValue(error);
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when / then
    await expect(wrapped.runRequest({ headers: {} })).rejects.toThrow(error);
    expect(globalOptions.logger.error).toHaveBeenCalled();
  });

  /**
   * With an errorPayload configured, a failed ref fetch degrades instead of throwing.
   */
  it('should fall back to the errorPayload when the ref fetch fails', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    globalOptions.onFetchLargePayloadFromRef = vi.fn().mockRejectedValue(new Error('nope'));
    globalOptions.errorPayload = { degraded: true };
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({ headers: {} });

    // then
    expect(response.data).toEqual({ degraded: true });
  });

  /**
   * Errors raised by the wrapped runner itself are not this wrapper's business.
   */
  it('should propagate errors from the wrapped runner', async () => {
    // given
    const error = new Error('Request failed with status code 404');

    runRequest.mockRejectedValue(error);
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when / then
    await expect(wrapped.runRequest({ headers: {} })).rejects.toThrow(error);
    expect(globalOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
  });

  /**
   * Disabled means untouched - no wrapper, no Accept header, no overhead.
   */
  it('should return the original runner when disabled', async () => {
    // given
    const runner = { runRequest, context: { functionName: 'my-lambda' } };

    // when
    const wrapped = withLargeResponse(runner, { ...globalOptions, enabled: false });
    await wrapped.runRequest({ headers: { accept: 'application/json' } });

    // then
    expect(wrapped).toBe(runner);
    expect(runRequest.mock.calls[0][0].headers).toEqual({ accept: 'application/json' });
  });

  /**
   * A request without headers is still given the flag.
   */
  it('should add the flag to a request that has no headers', async () => {
    // given
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    await wrapped.runRequest({});

    // then
    expect(runRequest.mock.calls[0][0].headers.Accept).toEqual(LARGE_PAYLOAD_MIME_TYPE);
  });
});
