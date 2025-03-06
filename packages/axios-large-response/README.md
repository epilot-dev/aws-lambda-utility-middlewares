# Axios Large Response

An Axios interceptor designed to handle large responses. By default, it assumes that your backend uses `@epilot/large-response-middleware`, as described in the [large-response-middleware README](https://github.com/epilot-dev/aws-lambda-utility-middlewares/blob/main/packages/large-response-middleware/README.md). However, it also supports custom callback function to fetch large payloads from a reference data, customizable reference property names, headers, and other options. See below for details.

It supports per-request options, so you can enable/disable the interceptor for a specific request (the axios config namespace is `axios-large-response` - please check the [Usage](#usage) section for more details). For now, it is disabled by default, however we can do some combinations based on the use cases, for example, we can disable it globally and enable it per-request if needed.

The interceptor is **disabled by default**, so you need to explicitly enable it.

## Installation

```bash
pnpm add @epilot/axios-large-response
npm install @epilot/axios-large-response
yarn add @epilot/axios-large-response
```

## Usage

```ts
import { axiosLargeResponse } from '@epilot/axios-large-response';
import axios from 'axios';

// Axios instance
const axiosInstance = axios.create();

// Example 1: disable interceptor globally so we enable it per-request
axiosLargeResponse(axiosInstance, {
  // enabled: false, -> disabled by default
  // ... other global options
});
...
const response = await axiosInstance.get('https://api.example.com/data', {
  'axios-large-response': {
    enabled: true,
    headerFlag: 'application/custom-large-response.vnd+json',
    refProperty: '$customRef',
    debug: true,
    onFetchLargePayloadFromRef: async (refUrl) => {
      // Custom handling for this specific request
      const response = await axios.get(refUrl);
      return response.data;
    }
  }
});

// Example 2: enable interceptor globally so we disable it per-request
axiosLargeResponse(axiosInstance, {
  enabled: true,
  // ... other global options
});
...
const response =  await axiosInstance.get('https://api.example.com/data', {
  'axios-large-response': {
    enabled: false
  }
});
```

## Options

| Name | Type | Default | Description |
|------|------|---------|-------------|
| enabled | Boolean | false | Enable/disable the interceptor |
| headerFlag | String | 'application/large-response.vnd+json' | Content type header indicating a large payload reference response |
| refProperty | String | '$payloadRef' | Property name containing the reference URL in the response |
| debug | Boolean | false | Enable debug logging |
| logger | Object | console | Logger object with debug() and error() methods |
| onFetchLargePayloadFromRef | Function | Fetches the reference URL and returns the full payload | Callback function to fetch the full payload from the reference URL |
| errorPayload | Unknown/Any | undefined | Error payload to return if the reference URL is not found or something goes wrong - this will be returned in the response data instead of throwing an error |
| disableWarnings | Boolean | false | Disable warnings, only available globally in the options |

For debug purposes, you can also set the `AXIOS_INTERCEPTOR_LARGE_RESPONSE_DEBUG` environment variable to `true` or `1` to enable debug logging.

## How it works

1. Adds the appropriate Accept header to requests to indicate large payload support;
2. Detects responses with the configured header content type;
3. If the response contains a reference in the specified refProperty, automatically fetches the full payload;
4. Returns the complete data in the response.

Example server response for a large payload:

```json
{
  "$payloadRef": "https://api.example.com/large-payloads/123"
}
```

After interceptor processing, the response becomes:

```json
{
  "huge": "data",
  "nested": {
    "complex": "structure"
  }
}
```

