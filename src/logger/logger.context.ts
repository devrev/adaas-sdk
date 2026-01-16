import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Async-aware context storage for tracking whether code is executing within SDK or user context.
 *
 * AsyncLocalStorage is used instead of a simple global variable because it automatically
 * propagates the context across async boundaries (await, Promise.then, setTimeout, etc.).
 * This ensures that even after multiple await calls in user code, the logging context
 * remains correct without requiring explicit context passing through function parameters.
 *
 * The stored boolean value indicates:
 * - `true`: Code is executing within SDK internals (logs tagged as is_sdk_log: true)
 * - `false`: Code is executing within user-provided handlers (logs tagged as is_sdk_log: false)
 */
const sdkLogContext = new AsyncLocalStorage<boolean>();

/**
 * Executes a function within user log context, marking all logs as user-originated.
 *
 * Use this to wrap user-provided callback functions (e.g., task handlers, event callbacks).
 * The context automatically propagates through any async operations within the function,
 * ensuring that all console.log calls inside are correctly tagged as user logs.
 *
 * @template T - The return type of the function
 * @param fn - The function to execute within user context (can be sync or async)
 * @returns The result of the function execution
 *
 * @example
 * ```typescript
 * await runWithUserLogContext(async () => {
 *   console.log('This is a user log');  // is_sdk_log: false
 *   await someAsyncOperation();
 *   console.log('Still a user log');    // is_sdk_log: false (context preserved)
 * });
 * ```
 */
export function runWithUserLogContext<T>(fn: () => T): T {
  return sdkLogContext.run(false, fn);
}

/**
 * Executes a function within SDK log context, marking all logs as SDK-originated.
 *
 * Use this to wrap SDK internal operations (e.g., emit, postState, adapter methods).
 * The context automatically propagates through any async operations within the function,
 * ensuring that all console.log calls inside are correctly tagged as SDK logs.
 *
 * This allows proper nesting: SDK code can call user code via runWithUserLogContext,
 * and when control returns to SDK code, logs are correctly attributed.
 *
 * @template T - The return type of the function
 * @param fn - The function to execute within SDK context (can be sync or async)
 * @returns The result of the function execution
 *
 * @example
 * ```typescript
 * await runWithSdkLogContext(async () => {
 *   console.log('SDK internal log');     // is_sdk_log: true
 *   runWithUserLogContext(() => {
 *     console.log('User handler log');   // is_sdk_log: false
 *   });
 *   console.log('Back to SDK log');      // is_sdk_log: true
 * });
 * ```
 */
export function runWithSdkLogContext<T>(fn: () => T): T {
  return sdkLogContext.run(true, fn);
}

/**
 * Retrieves the current SDK log context value.
 *
 * Returns whether the current execution context is within SDK code (true) or user code (false).
 * If no context has been set (e.g., during testing or edge cases), returns the provided default.
 *
 * @param defaultValue - The value to return if no context is currently set
 * @returns `true` if in SDK context, `false` if in user context, or defaultValue if unset
 */
export function getSdkLogContextValue(defaultValue: boolean): boolean {
  const storeValue = sdkLogContext.getStore();
  if (typeof storeValue === 'boolean') {
    return storeValue;
  }
  return defaultValue;
}
