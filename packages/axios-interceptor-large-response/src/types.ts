import type { AxiosInstance, AxiosStatic } from 'axios';

type LargePayloadResponse = {
  [refUrlProperty: string]: string;
};

type Logger = {
  debug: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

type AxiosInterceptorLargeResponseOptions = {
  debug?: boolean;
  logger?: Logger;
  headerFlag?: string;
  refUrlProperty?: string;
};

type AxiosInterceptorLargeResponse = (
  axiosInstance: AxiosInstance | AxiosStatic,
  axiosInterceptorLargeResponseOptions?: AxiosInterceptorLargeResponseOptions,
) => {
  requestInterceptorId: number;
  responseInterceptorId: number;
};

export type { AxiosInterceptorLargeResponse, AxiosInterceptorLargeResponseOptions, LargePayloadResponse, Logger };
