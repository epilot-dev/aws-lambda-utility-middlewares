import type { AxiosInstance, AxiosStatic } from 'axios';

type LargePayloadResponse = {
  [refUrlProperty: string]: string;
};

type Logger = {
  debug: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

type AxiosLargeResponseOptions = {
  enabled?: boolean;
  debug?: boolean;
  logger?: Logger;
  headerFlag?: string;
  refProperty?: string;
  onFetchLargePayloadFromRef?: (ref: string) => Promise<unknown>;
  errorPayload?: unknown;
};

type AxiosLargeResponse = (
  axiosInstance: AxiosInstance | AxiosStatic,
  axiosLargeResponseOptions?: AxiosLargeResponseOptions,
) => {
  requestInterceptorId: number;
  responseInterceptorId: number;
};

export type { AxiosLargeResponse, AxiosLargeResponseOptions, LargePayloadResponse, Logger };
