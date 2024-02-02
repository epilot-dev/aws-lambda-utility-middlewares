## Lambda Large Response Middleware

Enables Lambdas to return responses larger than 6MB by offloading the content to S3 and returning a reference to the S3 file.

**Limitations**

- This implementation currently provides support for API Gateway with Lambda Proxy Integration only.
- There are plans to extend this work as described here [#issue-1](https://github.com/epilot-dev/aws-lambda-utility-middlewares/issues/1)

---

<p align="center">
  <img src="https://raw.githubusercontent.com/epilot-dev/aws-lambda-utility-middlewares/main/packages/large-response-middleware/docs/out/architecture-1/Architecture%20-%20Sequence%20Diagram.svg" />
</p>

When a client can handle a Large Response, it must send a request with the HTTP Header `Accept: application/large-response.vnd+json`. The `application/large-response.vnd+json` is a custom MIME type indicating that the client agrees to receive a large response payload when necessary. The response body for the `large-response.vnd+json` MIME type is in the following format:

```json
{
  "$payload_ref": "http://<s3 file reference link>"
}
```

If the client provides the large response MIME type, the Lambda will not log an error using `Log.error`. Instead, it will rewrite the original response with a reference to the offloaded large payload. Furthermore, the rewritten response will include the HTTP header `Content-Type` with the value `application/large-response.vnd+json`.

If the client does not provide the large response MIME type, the Lambda will log an error with `Log.error` and rewrite the original response with a custom message (can be configured) and HTTP status code 413 (Payload Too Large).

### Middleware Configuration:

Supported Parameters:

| Parameter | Type | Description |
| --- | --- | --- |
| thresholdWarn | `number` | Warning threshold level (percentage of `sizeLimitInMB`), e.g: 0.80 |
| thresholdError | `number` | Error threshold level (percentage of `sizeLimitInMB`), e.g: 0.90 |
| sizeLimitInMB | `number` | Maximum allowed size limit in MB, e.g 6 |
| outputBucket | `string` | Identifier or name of the output S3 bucket |
| customErrorMessage | `string \| (event:APIGatewayProxyEventV2) => string ` | Custom error message to be returned when the response is too large and the client does not support large responses (no accept header) |
| groupRequestsBy | `function - mapper` | Function to group requests, based on API Gateway event V2. Defaults to 'all' |

Example Usage:

```ts
withLargeResponseHandler({
  thresholdWarn: 0.85, // 85% of the limit = 5.1MB
  thresholdError: 0.9, // 90% of the limit = 5.4MB
  sizeLimitInMB: 6,
}),
```
