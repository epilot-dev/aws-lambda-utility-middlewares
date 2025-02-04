import { describe, it, expect, beforeEach, vi } from 'vitest';
import Log from '@dazn/lambda-powertools-logger';
import { getOrgIdFromContext } from './__tests__/util';
import {LARGE_RESPONSE_HANDLED_INFO, LARGE_RESPONSE_MIME_TYPE, LARGE_RESPONSE_USER_INFO, withLargeResponseHandler} from './';
import { uploadFile } from './file-storage-service';
import * as Lambda from 'aws-lambda';

vi.mock('@dazn/lambda-powertools-logger');
vi.mock('./file-storage-service')

const uploadFileMock = vi.mocked(uploadFile);
uploadFileMock.mockResolvedValue({
  url: 'http://localhost:4566/the-bucket-list/red-redington/2023-12-13/la-caballa',
  filename: 'red-redington/2023-12-13/la-caballa',
});
const mockLogger = vi.mocked(Log);


beforeEach(() => {
  vi.clearAllMocks();
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
    await middleware.after({
      event: {
        requestContext: {},
      },
      response: {
        body: '',
      },
    } as any);

    expect(mockLogger.warn).toHaveBeenCalledTimes(0);
    expect(mockLogger.error).toHaveBeenCalledTimes(0);
  });

  it('should log WARN with "Large response detected" when content length is over WARN threshold', async () => {
    const middleware = withLargeResponseHandler({
      thresholdWarn: 0.5,
      thresholdError: 0.9,
      sizeLimitInMB: 2,
      outputBucket: 'the-bucket-list',
      groupRequestsBy: getOrgIdFromContext,
    })
    
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

    expect(mockLogger.warn).toHaveBeenCalledWith(`Large response detected. ${LARGE_RESPONSE_USER_INFO}`, {
      contentLength: 1572872,
      event: { requestContext: {} },
      request: {},
      response_size_mb: '1.50',
      $payload_ref: expect.stringMatching(
        /http:\/\/localhost:4566\/the-bucket-list\/red-redington\/\d+-\d+-\d+\/la-caballa/,
      ),
    });
  });

  it('should log ERROR with "Large response detected (limit exceeded)" when content length is over ERROR threshold', async () => {
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

    expect(mockLogger.error).toHaveBeenCalledWith(`Large response detected (limit exceeded). ${LARGE_RESPONSE_USER_INFO}`, {
      contentLength: 1939873,
      event: { requestContext: {} },
      request: {},
      response_size_mb: '1.85',
      $payload_ref: expect.stringMatching(
        /http:\/\/localhost:4566\/the-bucket-list\/red-redington\/\d+-\d+-\d+\/la-caballa/,
      ),
    });

    expect(uploadFileMock).toHaveBeenCalledWith({
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

    expect(JSON.parse(requestResponseContext.response?.body)?.message).toBe(LARGE_RESPONSE_USER_INFO);
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

      expect(mockLogger.error).not.toHaveBeenCalled();

      expect(uploadFileMock).toHaveBeenCalledWith({
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

  describe('when request header "X-Handle-Large-Response:true" is given', () => {
    it('should return 413 and not log ERROR with "Large response detected (limit exceeded)" when content length is over ERROR threshold', async () => {
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
          requestContext: {
            requestId: 'request-id-123',
            authorizer: {
              lambda: {
                organizationId: 'red-redington',
              },
            },
          } as any,
          headers: {
            'Handle-Large-Response': 'true',
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

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(uploadFileMock).not.toHaveBeenCalled();

      const parsedBody = JSON.parse(requestResponseContext.response.body);

      expect(requestResponseContext.response).toMatchObject({
        isBase64Encoded: false,
        statusCode: 413,
        headers: {
          random: requestResponseContext.response.headers.random,
          'content-type': 'application/large-response.vnd+json',
        },
      });
      expect(parsedBody).toMatchObject({
        meta: {
          content_length_mb: '1.85',
        },
        message: LARGE_RESPONSE_HANDLED_INFO,
      });
    });
  });
});
