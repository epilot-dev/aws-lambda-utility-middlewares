[![CI](https://github.com/epilot-dev/aws-lambda-utility-middlewares/actions/workflows/ci.yml/badge.svg)](https://github.com/epilot-dev/aws-lambda-utility-middlewares/actions/workflows/ci.yml)
[![License](http://img.shields.io/:license-mit-blue.svg)](https://github.com/epilot-dev/aws-lambda-utility-middlewares/blob/main/)

![banner](./static/banner.webp)

## AWS Lambda Utility Middlewares

This repo is meant to host a set of useful AWS Lambda Utilities our team has been developing during their daily activities on the support of our SaaS platform.

## Middlewares

- [LargeResponseHandlerMiddleware](./packages/large-response-middleware/), AWS Lambdas have a known limitation regarding the payload size of their responses, currently 6MB. This middleware enables a service to log and save large responses to an S3 bucket, thus allowing developers to look into the cause of those large responses. This middleware also accepts a special header that enables the rewrite of the response with a $ref pointing to the large response stored in S3, allowing clients to recover gracefully.

## Contributing
The packages under this repo are free and open source software. PRs welcome!

## Disclaimer

This library is in beta. Missing features, incomplete documentation and breaking API changes are to be expected!