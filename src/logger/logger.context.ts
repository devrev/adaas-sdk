import { AsyncLocalStorage } from 'node:async_hooks';

const sdkLogContext = new AsyncLocalStorage<boolean>();

export function ensureSdkLogContext(defaultValue = true): void {
  const storeValue = sdkLogContext.getStore();
  if (typeof storeValue !== 'boolean') {
    sdkLogContext.enterWith(defaultValue);
  }
}

export function runWithUserLogContext<T>(fn: () => T): T {
  return sdkLogContext.run(false, fn);
}

export function getSdkLogContextValue(defaultValue: boolean): boolean {
  const storeValue = sdkLogContext.getStore();
  if (typeof storeValue === 'boolean') {
    return storeValue;
  }
  return defaultValue;
}
