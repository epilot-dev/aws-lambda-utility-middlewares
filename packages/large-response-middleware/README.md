## Lambda Large Response Middleware

Enables Lambdas to return responses larger than 6MB by offloading the content to S3 and returning a reference to the S3 file.

![](../../docs/out/architecture-1/Architecture%20-%20Sequence%20Diagram.svg)

When a client can handle a Large Response, it must send a request with the HTTP Header Accept: application/large-response.vnd+json. The application/large-response.vnd+json is a custom MIME type indicating that the client agrees to receive a large response payload when necessary. The response body for the large-response.vnd+json MIME type is in the following format:

```json
{
  "$payload_ref": "http://<s3 file reference link>"
}
```

If the client provides the large response MIME type, the Lambda will not log an error using Log.error. Instead, it will rewrite the original response with a reference to the offloaded large payload. Furthermore, the rewritten response will include the HTTP header Content-Type with the value application/large-response.vnd+json.

If the client does not provide the large response MIME type, the Lambda will log an error with Log.error, and the response will fail due to an excessively large response body.

### Middleware Configuration:

Supported Parameters:

| Parameter       | Type              | Description                                                                  |
| --------------- | ----------------- | ---------------------------------------------------------------------------- |
| thresholdWarn   | number            | Warning threshold level (percentage of `sizeLimitInMB`), e.g: 0.80           |
| thresholdError  | number            | Error threshold level (percentage of `sizeLimitInMB`), e.g: 0.90             |
| sizeLimitInMB   | number            | Maximum allowed size limit in MB, e.g 6                                      |
| outputBucket    | string            | Identifier or name of the output S3 bucket                                   |
| groupRequestsBy | function - mapper | Function to group requests, based on API Gateway event V2. Defaults to 'all' |

Example Usage:

```ts
withLargeResponseHandler({
  thresholdWarn: 0.85, // 85% of the limit = 5.1MB
  thresholdError: 0.9, // 90% of the limit = 5.4MB
  sizeLimitInMB: 6,
}),
```
