/* eslint-disable @typescript-eslint/no-explicit-any */
import Log from '@dazn/lambda-powertools-logger';
import * as Lambda from 'aws-lambda';

import { getOrgIdFromContext } from './__tests__/util';

import * as middleware from './';
import { LARGE_RESPONSE_MIME_TYPE, withLargeResponseHandler } from './';

const uploadFileSpy = jest.spyOn(middleware, 'uploadFile').mockResolvedValue({
  filename: 'red-redington/2023-12-13/la-caballa',
  url: 'http://localhost:4566/the-bucket-list/red-redington/2023-12-13/la-caballa',
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('withLargeResponseHandler', () => {
  it('should not log WARN or ERROR if thresholds are not met', async () => {
    const middleware = withLargeResponseHandler({
      thresholdWarn: 0.5,
      thresholdError: 0.9,
      sizeLimitInMB: 1,
      outputBucket: 'the-bucket-list',
      groupRequestsBy: getOrgIdFromContext,
    });
    const LogWarnSpy = jest.spyOn(Log, 'warn');
    const LogErrorSpy = jest.spyOn(Log, 'error');

    await middleware.after({
      event: {
        requestContext: {},
      },
      response: {
        body: '',
      },
    } as any);

    expect(LogWarnSpy).toHaveBeenCalledTimes(0);
    expect(LogErrorSpy).toHaveBeenCalledTimes(0);
  });

  it('should log WARN with "Large response detected" when content length is over WARN threshold', async () => {
    const middleware = withLargeResponseHandler({
      thresholdWarn: 0.5,
      thresholdError: 0.9,
      sizeLimitInMB: 2,
      outputBucket: 'the-bucket-list',
      groupRequestsBy: getOrgIdFromContext,
    });
    const LogWarnSpy = jest.spyOn(Log, 'warn');

    await middleware.after({
      event: {
        requestContext: {},
      },
      response: {
        headers: {
          random: Buffer.alloc(0.5 * 1024 * 1024, 'a').toString(), // 0.5MB
        },
        body: Buffer.alloc(1024 * 1024, 'a').toString(), // 1MB
      },
    } as any);

    expect(LogWarnSpy).toHaveBeenCalledWith(
      "Large response detected. Call the API with the HTTP header 'Accept: application/large-response.vnd+json' to receive the payload through an S3 ref and avoid HTTP 500 errors.",
      {
        contentLength: 1572872,
        event: { requestContext: {} },
        request: {},
        response_size_mb: '1.50',
        $payload_ref: expect.stringMatching(
          /http:\/\/localhost:4566\/the-bucket-list\/red-redington\/\d+-\d+-\d+\/la-caballa/,
        ),
      },
    );
  });

  it('should log ERROR with "Large response detected (limit exceeded)" when content length is over ERROR threshold', async () => {
    const middleware = withLargeResponseHandler({
      thresholdWarn: 0.5,
      thresholdError: 0.9,
      sizeLimitInMB: 1,
      outputBucket: 'the-bucket-list',
      groupRequestsBy: getOrgIdFromContext,
    });
    const LogErrorSpy = jest.spyOn(Log, 'error');
    const content = Buffer.alloc(1024 * 1024, 'a').toString();
    const requestResponseContext = {
      event: {
        requestContext: {},
      },
      response: {
        headers: {
          random: Buffer.alloc(0.85 * 1024 * 1024, 'a').toString(), // 0.85MB
        },
        body: content,
      },
    } as any;

    await middleware.after(requestResponseContext);

    expect(LogErrorSpy).toHaveBeenCalledWith(
      "Large response detected (limit exceeded). Call the API with the HTTP header 'Accept: application/large-response.vnd+json' to receive the payload through an S3 ref and avoid HTTP 500 errors.",
      {
        contentLength: 1939873,
        event: { requestContext: {} },
        request: {},
        response_size_mb: '1.85',
        $payload_ref: expect.stringMatching(
          /http:\/\/localhost:4566\/the-bucket-list\/red-redington\/\d+-\d+-\d+\/la-caballa/,
        ),
      },
    );

    expect(uploadFileSpy).toHaveBeenCalledWith({
      bucket: 'the-bucket-list',
      content,
      contentType: 'application/json',
      fileName: undefined,
      groupId: 'all',
    });
  });

  it('should overwrite response with default ERROR message + correct status when content length is over ERROR threshold', async () => {
    const middleware = withLargeResponseHandler({
      thresholdWarn: 0.5,
      thresholdError: 0.9,
      sizeLimitInMB: 1,
      outputBucket: 'the-bucket-list',
      groupRequestsBy: getOrgIdFromContext,
    });
    const content = Buffer.alloc(1024 * 1024, 'a').toString();
    const requestResponseContext = {
      event: {
        requestContext: {},
      },
      response: {
        headers: {
          random: Buffer.alloc(0.85 * 1024 * 1024, 'a').toString(), // 0.85MB
        },
        body: content,
      },
    } as any;

    await middleware.after(requestResponseContext);

    expect(JSON.parse(requestResponseContext.response?.body)?.message).toBe(
      "Call the API with the HTTP header 'Accept: application/large-response.vnd+json' to receive the payload through an S3 ref and avoid HTTP 500 errors.",
    );
    expect(requestResponseContext?.response?.statusCode).toBe(413);
  });

  it('should overwrite response with ERROR message (string) + correct status when content length is over ERROR threshold', async () => {
    const middleware = withLargeResponseHandler({
      thresholdWarn: 0.5,
      thresholdError: 0.9,
      customErrorMessage: 'Custom error message',
      sizeLimitInMB: 1,
      outputBucket: 'the-bucket-list',
      groupRequestsBy: getOrgIdFromContext,
    });
    const content = Buffer.alloc(1024 * 1024, 'a').toString();
    const requestResponseContext = {
      event: {
        requestContext: {},
      },
      response: {
        headers: {
          random: Buffer.alloc(0.85 * 1024 * 1024, 'a').toString(), // 0.85MB
        },
        body: content,
      },
    } as any;

    await middleware.after(requestResponseContext);

    expect(JSON.parse(requestResponseContext.response?.body)?.message).toBe('Custom error message');
    expect(requestResponseContext?.response?.statusCode).toBe(413);
  });

  it('should overwrite response with custom ERROR message (callback function) + correct status when content length is over ERROR threshold', async () => {
    const middleware = withLargeResponseHandler({
      thresholdWarn: 0.5,
      thresholdError: 0.9,
      customErrorMessage: (event: Lambda.APIGatewayProxyEventV2) =>
        `Custom error message for ${event.requestContext?.requestId}`,
      sizeLimitInMB: 1,
      outputBucket: 'the-bucket-list',
      groupRequestsBy: getOrgIdFromContext,
    });
    const content = Buffer.alloc(1024 * 1024, 'a').toString();
    const requestResponseContext = {
      event: {
        requestContext: {
          requestId: 'request-id-123',
        },
      },
      response: {
        headers: {
          random: Buffer.alloc(0.85 * 1024 * 1024, 'a').toString(), // 0.85MB
        },
        body: content,
      },
    } as any;

    await middleware.after(requestResponseContext);

    expect(JSON.parse(requestResponseContext.response?.body)?.message).toBe('Custom error message for request-id-123');
    expect(requestResponseContext?.response?.statusCode).toBe(413);
  });

  describe('when request header "Accept":"application/large-response.vnd+json" is given', () => {
    it('should not log ERROR with "Large response detected (limit exceeded)" when content length is over ERROR threshold', async () => {
      const middleware = withLargeResponseHandler({
        thresholdWarn: 0.5,
        thresholdError: 0.9,
        sizeLimitInMB: 1,
        outputBucket: 'the-bucket-list',
        groupRequestsBy: getOrgIdFromContext,
      });
      const LogErrorSpy = jest.spyOn(Log, 'error');
      const content = Buffer.alloc(1024 * 1024, 'a').toString();
      const requestResponseContext = {
        event: {
          requestContext: {
            requestId: 'request-id-123',
            authorizer: {
              lambda: {
                organizationId: 'red-redington',
              },
            },
          } as any,
          headers: {
            Accept: LARGE_RESPONSE_MIME_TYPE,
          },
        } as Partial<Lambda.APIGatewayProxyEventV2>,
        response: {
          headers: {
            random: Buffer.alloc(0.85 * 1024 * 1024, 'a').toString(), // 0.85MB
          },
          body: content,
        },
      } as any;

      await middleware.after(requestResponseContext);

      expect(LogErrorSpy).not.toHaveBeenCalled();

      expect(uploadFileSpy).toHaveBeenCalledWith({
        bucket: 'the-bucket-list',
        content,
        contentType: 'application/json',
        fileName: 'request-id-123',
        groupId: 'red-redington',
      });

      expect(requestResponseContext.response).toStrictEqual({
        body: expect.stringMatching(
          /{"\$payload_ref":"http:\/\/localhost:4566\/the-bucket-list\/red-redington\/\d+-\d+-\d+\/la-caballa"}/,
        ),
        headers: {
          random: requestResponseContext.response.headers.random,
          'content-type': 'application/large-response.vnd+json',
        },
      });
    });
  });
});
