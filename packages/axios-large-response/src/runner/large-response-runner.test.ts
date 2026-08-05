import { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosLargeResponseOptions } from '../types';
import { LARGE_PAYLOAD_MIME_TYPE, NAMESPACE } from '../utils/utils';
import { withLargeResponse } from './large-response-runner';

/**
 * Test suite for the withLargeResponse runner wrapper.
 *
 * The runner is described structurally, so a plain object stands in for any
 * transport-specific runner.
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
   * The runner's other members are part of its contract and must survive wrapping:
   * openapi-client-axios invokes a registered runner as
   * `runner.runRequest(request, operation, runner.context)`.
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
   * A frozen or sealed runner contributes a non-configurable `runRequest` descriptor, so
   * the replacement has to be overridden as the copy is built rather than redefined on it.
   */
  it.each([
    ['frozen', Object.freeze],
    ['sealed', Object.seal],
  ])('should wrap a %s runner', async (_label, harden) => {
    // given
    const context = { functionName: 'my-lambda' };
    const runner = harden({ runRequest, context });

    // when
    const wrapped = withLargeResponse(runner, globalOptions);
    const response = await wrapped.runRequest({ headers: {} });

    // then
    expect(wrapped.context).toEqual(context);
    expect(response.data).toEqual({ foo: 'bar' });
  });

  /**
   * A concretely typed runner, unlike a vi.fn() double, actually exercises the generic
   * signature: a runner declaring narrower request/response types must still be accepted,
   * and its sibling members must survive wrapping at the type level, not just at runtime.
   */
  it('should accept a concretely typed runner and keep its members typed', async () => {
    // given
    type Operation = { operationId: string };
    type LambdaContext = { functionName: string };

    const lambdaRunner = {
      context: { functionName: 'my-lambda' } satisfies LambdaContext,
      runRequest: async (
        _request: AxiosRequestConfig,
        _operation: Operation,
        _context: LambdaContext,
      ): Promise<AxiosResponse> =>
        ({
          status: 200,
          headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
          data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
        }) as unknown as AxiosResponse,
    };

    // when
    const wrapped = withLargeResponse(lambdaRunner, globalOptions);
    const functionName: string = wrapped.context.functionName;
    const response = await wrapped.runRequest({}, { operationId: 'getThings' }, wrapped.context);

    // then
    expect(functionName).toEqual('my-lambda');
    expect(response.data).toEqual({ huge: 'data' });
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

  /**
   * A class-based runner must keep working: `runRequest` stays bound to the original, and
   * prototype methods and class identity survive. Arrow-function doubles never catch this.
   */
  it('should keep a class-based runner working, with its prototype intact', async () => {
    // given
    class LambdaRunner {
      constructor(public context: { functionName: string }) {}

      async runRequest(_request: unknown) {
        return {
          headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
          data: { $payload_ref: `https://bucket.s3.amazonaws.com/${this.context.functionName}` },
        };
      }

      getFunctionName() {
        return this.context.functionName;
      }
    }

    const runner = new LambdaRunner({ functionName: 'my-lambda' });

    // when
    const wrapped = withLargeResponse(runner, globalOptions);
    const response = await wrapped.runRequest({});

    // then
    expect(wrapped.getFunctionName()).toEqual('my-lambda');
    expect(wrapped instanceof LambdaRunner).toBe(true);
    expect(globalOptions.onFetchLargePayloadFromRef).toHaveBeenCalledWith('https://bucket.s3.amazonaws.com/my-lambda');
    expect(response.data).toEqual({ huge: 'data' });
  });

  /**
   * Header containers need not store values as own enumerable properties - a WHATWG
   * `Headers` from a fetch-based runner exposes them only through `entries()`.
   */
  it('should detect the flag on a WHATWG Headers container', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': LARGE_PAYLOAD_MIME_TYPE }),
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({});

    // then
    expect(response.data).toEqual({ huge: 'data' });
  });

  /**
   * The counterpart to the WHATWG case, and the one that actually ships: axios' own
   * `AxiosHeaders` keeps values as own enumerable properties and has no `entries()`, so it
   * must fall through to `Object.entries`. Pinned against the real type rather than a plain
   * object, so an axios release that adds `entries()` fails here instead of silently
   * changing which branch runs.
   */
  it('should detect the flag on an AxiosHeaders container', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: AxiosHeaders.from({ 'content-type': LARGE_PAYLOAD_MIME_TYPE }),
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({});

    // then
    expect(response.data).toEqual({ huge: 'data' });
  });

  /**
   * A `Map` is the other shape that hides its values behind `entries()`.
   */
  it('should detect the flag on a Map container', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: new Map([['content-type', LARGE_PAYLOAD_MIME_TYPE]]),
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({});

    // then
    expect(response.data).toEqual({ huge: 'data' });
  });

  /**
   * Own property descriptors are carried over, not just own enumerable values, so a runner
   * member hidden from enumeration still survives wrapping.
   */
  it('should preserve a non-enumerable member of the wrapped runner', () => {
    // given
    const runner: { runRequest: typeof runRequest; hidden?: string } = { runRequest };

    Object.defineProperty(runner, 'hidden', { value: 'kept', enumerable: false });

    // when
    const wrapped = withLargeResponse(runner, globalOptions);

    // then
    expect(wrapped.hidden).toEqual('kept');
    expect(Object.keys(wrapped)).not.toContain('hidden');
  });

  /**
   * Deliberate asymmetry with the interceptor, pinned so it stays a decision rather than a
   * surprise: the interceptor can be disabled globally and enabled per request, but a
   * disabled wrapper is never installed, so there is nothing left to read the request.
   * Wrap with `enabled: true` and opt individual requests out instead.
   */
  it('should not let a per-request enabled re-enable a globally disabled wrapper', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const wrapped = withLargeResponse({ runRequest }, { ...globalOptions, enabled: false });

    // when
    const response = await wrapped.runRequest({ [NAMESPACE]: { enabled: true } });

    // then
    expect(globalOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
    expect(response.data).toEqual({ $payload_ref: 'https://bucket.s3.amazonaws.com/ref' });
  });

  /**
   * A runner that does not parse the proxy body leaves the envelope as a JSON string;
   * treating that as "not an envelope" would skip the fetch in the case this exists for.
   */
  it('should resolve an envelope the transport left as an unparsed JSON string', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
      data: JSON.stringify({ $payload_ref: 'https://bucket.s3.amazonaws.com/ref' }),
    });
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({});

    // then
    expect(response.data).toEqual({ huge: 'data' });
  });

  /**
   * `errorPayload` is "configured" whenever it is not undefined - a falsy value is a
   * deliberate degraded payload, not an absent option.
   */
  it('should degrade to a falsy errorPayload rather than throwing', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    globalOptions.onFetchLargePayloadFromRef = vi.fn().mockRejectedValue(new Error('s3 down'));
    globalOptions.errorPayload = null;
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({});

    // then
    expect(response.data).toBeNull();
  });

  /**
   * `headerFlag` is a caller-supplied option: it may arrive with media-type parameters, and
   * it may be present but undefined (an unset env var spread over the defaults).
   */
  it('should match a headerFlag that carries media type parameters', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const wrapped = withLargeResponse(
      { runRequest },
      {
        ...globalOptions,
        headerFlag: `${LARGE_PAYLOAD_MIME_TYPE}; charset=utf-8`,
      },
    );

    // when
    const response = await wrapped.runRequest({});

    // then
    expect(response.data).toEqual({ huge: 'data' });
  });

  it('should pass responses through when headerFlag is undefined, rather than throwing', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: {},
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const wrapped = withLargeResponse({ runRequest }, { ...globalOptions, headerFlag: undefined });

    // when
    const response = await wrapped.runRequest({});

    // then
    expect(globalOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
    expect(response.data).toEqual({ $payload_ref: 'https://bucket.s3.amazonaws.com/ref' });
  });

  /**
   * The runner honours the same per-request options channel as the interceptor, and strips
   * it from the forwarded request so it never reaches the transport as payload.
   */
  it('should honour per-request options and strip them from the forwarded request', async () => {
    // given
    runRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': LARGE_PAYLOAD_MIME_TYPE },
      data: { $payload_ref: 'https://bucket.s3.amazonaws.com/ref' },
    });
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    const response = await wrapped.runRequest({
      [NAMESPACE]: { onFetchLargePayloadFromRef: vi.fn().mockResolvedValue({ perRequest: true }) },
    });

    // then
    expect(response.data).toEqual({ perRequest: true });
    expect(globalOptions.onFetchLargePayloadFromRef).not.toHaveBeenCalled();
    expect(Object.keys(runRequest.mock.calls[0][0])).toEqual(['headers']);
  });

  /**
   * A per-request `enabled: false` opts a single request out, as on the interceptor path.
   */
  it('should let a per-request enabled false opt out of a single request', async () => {
    // given
    const wrapped = withLargeResponse({ runRequest }, globalOptions);

    // when
    await wrapped.runRequest({ headers: { accept: 'application/json' }, [NAMESPACE]: { enabled: false } });

    // then
    expect(runRequest.mock.calls[0][0].headers).toEqual({ accept: 'application/json' });
  });
});
