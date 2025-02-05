[![CI](https://github.com/epilot-dev/aws-lambda-utility-middlewares/actions/workflows/ci.yml/badge.svg)](https://github.com/epilot-dev/aws-lambda-utility-middlewares/actions/workflows/ci.yml)
[![License](http://img.shields.io/:license-mit-blue.svg)](https://github.com/epilot-dev/aws-lambda-utility-middlewares/blob/main/)

![banner](./static/banner.webp)

## AWS Lambda Utility Middlewares

This repository is designed to host a collection of useful AWS Lambda Utilities developed by our team, which may be beneficial to the broader community.

## Middlewares

- [Large Response Middleware](./packages/large-response-middleware/): AWS Lambda has a known limitation regarding the payload size of responses, which is currently set at 6MB. This middleware allows a service to log and save large responses to an S3 bucket, enabling developers to investigate the causes of such large responses. Furthermore, this middleware accepts a special header that allows the rewriting of the response with a $ref pointing to the large payload stored in S3, enabling clients to recover gracefully.

- [Lambda Server-Timing Middleware (ext)](https://github.com/NishuGoel/lambda-server-timing/tree/main/src): Enables Lambdas to return responses with Server-Timing Header allowing to to pass request-specific timings from the backend to the browser. Allows a server to communicate performance metrics about the request-response cycle to the user agent. It also standardizes a JavaScript interface to enable applications to collect, process, and act on these metrics to optimize application delivery.

## Contributing

The packages contained in this repository are free and open-source software. Pull requests are welcome!

## Packages releases

This repository requires manual releases of the packages for now. We will be including `changesets` (or similar) in the future to manage packages releases in the monorepo.

## Disclaimer

This library is currently in beta. Expect missing features, incomplete documentation, and potential breaking changes in the API.
