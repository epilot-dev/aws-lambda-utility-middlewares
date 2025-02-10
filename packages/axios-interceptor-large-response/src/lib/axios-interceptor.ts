import { AxiosInstance } from "axios";

export const axiosInterceptor = (axiosInstance: AxiosInstance) => {
  axiosInstance.interceptors.response.use((response) => {
    return response;
  });
};
