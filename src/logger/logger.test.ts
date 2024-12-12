import { AxiosError } from 'axios';
import { getPrintableState, formatAxiosError } from './logger';

it('getPrintableState should return printable state', () => {
  const state = {
    test_key: 'test_value',
    big_array: Array.from({ length: 1000 }, (_, index) => index),
    nested_object: {
      nested_key: 'nested_value',
      nested_array: Array.from({ length: 1000 }, (_, index) => index),
    },
  };

  const printableState = getPrintableState(state);

  expect(printableState).toEqual({
    test_key: 'test_value',
    big_array: {
      type: 'array',
      length: 1000,
      firstItem: 0,
      lastItem: 999,
    },
    nested_object: {
      nested_key: 'nested_value',
      nested_array: {
        type: 'array',
        length: 1000,
        firstItem: 0,
        lastItem: 999,
      },
    },
  });
});

it('formatAxiosError should return formatted error', () => {
  const error = {
    response: {
      status: 500,
      data: 'Internal server error',
    },
    config: {
      method: 'GET',
    },
  } as AxiosError;

  const formattedError = formatAxiosError(error);

  expect(formattedError).toEqual({
    status: 500,
    data: 'Internal server error',
    method: 'GET',
    baseURL: undefined,
    url: undefined,
    payload: undefined,
  });
});
