import axios, { InternalAxiosRequestConfig, isAxiosError } from 'axios';
import {
  LAMBDA_LIMIT_EXCEEDED,
  RATE_LIMIT_EXCEEDED,
  RATE_LIMIT_EXCEEDED_STATUS_CODE,
} from './constants';
import { HTTPResponse } from './types';

export const defaultResponse: HTTPResponse = {
  data: {
    delay: 0,
    nextPage: 1,
    records: [],
  },
  message: '',
  success: false,
};

export default class HTTPClient {
  private retryAfter = 0;
  private retryAt = 0;
  private axiosInstance = axios.create();

  constructor() {
    // Add request interceptor to check for retryAfter before making a request
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Check if retryAfter is not 0 and return a LIMIT_EXCEEDED error
        if (this.retryAfter !== 0) {
          // check if the current time is greater than the retryAt time
          const currentTime = new Date().getTime();
          if (currentTime < this.retryAt) {
            console.error(
              'Rate limit exceeded. Interceptor has retryAfter: ' +
                this.retryAfter
            );
            // Rate limit exceeded.
            return Promise.reject(RATE_LIMIT_EXCEEDED);
          } else {
            // Reset the retryAfter
            this.retryAfter = 0;
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   *
   * Function to make a GET call to the endpoint.
   * There is special handling for rate limit exceeded error.
   * In case of rate limit exceeded, the function returns success as true and the delay time in seconds
   * In case of any other error, the function returns success as false and the error message
   */
  async getCall(
    endpoint: string,
    headers: Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: any
  ): Promise<HTTPResponse> {
    // Return the LIMIT_EXCEEDED error if the retryAfter is not 0
    try {
      const res = await this.axiosInstance.get(endpoint, {
        headers: headers,
        params: params,
      });
      return {
        ...defaultResponse,
        data: {
          delay: 0,
          records: res.data,
        },
        success: true,
      };
    } catch (error: unknown) {
      console.log('Error in getCall: ' + JSON.stringify(error));
      // send error to adapter
      if (isAxiosError(error)) {
        if (error.response?.status === RATE_LIMIT_EXCEEDED_STATUS_CODE) {
          this.retryAfter = error.response.headers['retry-after']
            ? error.response.headers['retry-after']
            : 0;
          this.retryAt = new Date().getTime() + this.retryAfter * 1000;
          console.warn(
            'Rate limit exceeded. Error code: ' +
              error.response.status +
              ' RetryAfter: ' +
              this.retryAfter +
              ' RetryAt: ' +
              this.retryAt
          );
          return {
            data: {
              delay: this.retryAfter,
              records: [],
            },
            message: RATE_LIMIT_EXCEEDED,
            success: true,
          };
        }
        if (error.response) {
          return { ...defaultResponse, message: error.response.data };
        } else {
          return { ...defaultResponse, message: error.message };
        }
      } else {
        if (this.retryAfter !== 0) {
          console.warn(
            'Rate limit exceeded. Going to return the following response: ' +
              JSON.stringify(error)
          );
          return {
            data: {
              delay: this.retryAfter,
              records: [],
            },
            message:
              typeof error === 'string'
                ? error
                : JSON.stringify(error, Object.getOwnPropertyNames(error)),
            success: true,
          };
        }
        return {
          data: {
            delay: this.retryAfter,
            records: [],
          },
          message:
            typeof error === 'string'
              ? error
              : JSON.stringify(error, Object.getOwnPropertyNames(error)),
          success: false,
        };
      }
    }
  }
}
