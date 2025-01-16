import { AxiosError } from 'axios';
import { getPrintableState, serializeAxiosError } from './logger';

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

it('serializeAxiosError should return formatted error', () => {
  const error = {
    response: {
      status: 500,
      data: 'Internal server error',
    },
    config: {
      method: 'GET',
    },
  } as AxiosError;

  const formattedError = serializeAxiosError(error);

  expect(formattedError).toEqual({
    config: {
      method: 'GET',
      params: undefined,
      url: undefined,
    },
    isAxiosError: true,
    isCorsOrNoNetworkError: false,
    response: {
      data: 'Internal server error',
      headers: undefined,
      status: 500,
      statusText: undefined,
    },
  });
});
