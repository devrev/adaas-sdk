/**
 * Creates a deep read-only proxy that prevents mutations to an object and its nested properties.
 * When a mutation is attempted, it logs a warning and ignores the mutation.
 *
 * @param target - The object to wrap in a read-only proxy
 * @param path - The current property path (used for warning messages)
 * @returns A proxy that prevents mutations
 */
export function createReadOnlyProxy<T extends object>(
  target: T,
  path: string = 'state'
): T {
  const proxyCache = new WeakMap<object, object>();

  function createProxy<O extends object>(obj: O, currentPath: string): O {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    const cached = proxyCache.get(obj);
    if (cached) {
      return cached as O;
    }

    const proxy = new Proxy(obj, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);

        if (typeof prop === 'symbol') {
          return value;
        }

        if (value !== null && typeof value === 'object') {
          return createProxy(value, `${currentPath}.${String(prop)}`);
        }

        return value;
      },

      set(_target, prop, _value) {
        console.warn(
          `Attempted to modify ${currentPath}.${String(prop)} during timeout. ` +
            `State modifications are not allowed after timeout is triggered.`
        );
        return true;
      },

      deleteProperty(_target, prop) {
        console.warn(
          `Attempted to delete ${currentPath}.${String(prop)} during timeout. ` +
            `State modifications are not allowed after timeout is triggered.`
        );
        return true;
      },

      defineProperty(_target, prop, _descriptor) {
        console.warn(
          `Attempted to define ${currentPath}.${String(prop)} during timeout. ` +
            `State modifications are not allowed after timeout is triggered.`
        );
        return true;
      },
    });

    proxyCache.set(obj, proxy);
    return proxy;
  }

  return createProxy(target, path);
}
