[![CI](https://github.com/epilot-dev/aws-lambda-utility-middlewares/actions/workflows/ci.yml/badge.svg)](https://github.com/epilot-dev/aws-lambda-utility-middlewares/actions/workflows/ci.yml)
[![License](http://img.shields.io/:license-mit-blue.svg)](https://github.com/epilot-dev/aws-lambda-utility-middlewares/blob/main/)

## AWS Lambda Utility Middlewares

This repo is meant to host a set of useful AWS Lambda Utilities our team has been developing during their daily activities on the support of our SaaS platform.

## Middlewares

- [LargeResponseHandlerMiddleware](./packages/large-response-handler-middleware/), AWS Lambdas have a known limitation regarding the payload size of their responses, which is set to 6MB. This middleware enables a service to log and save large responses to an S3 bucket, thus given developers the ability to look into and debug the cause of such large response. Additionally, this middleware also accepts a special header, that will enable it to reply to the client with a payload $ref pointing to the payload stored in S3. This enables clients to recover gracefully, will they wish to do so.

## Contributing
The packages under this repo are free and open source software. PRs welcome!

## Disclaimer

This library is in beta. Missing features, incomplete documentation and breaking API changes are to be expected!