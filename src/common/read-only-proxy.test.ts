import { createReadOnlyProxy } from './read-only-proxy';

describe('createReadOnlyProxy', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should allow reading properties', () => {
    const original = { foo: 'bar', nested: { value: 123 } };
    const proxy = createReadOnlyProxy(original);

    expect(proxy.foo).toBe('bar');
    expect(proxy.nested.value).toBe(123);
  });

  it('should prevent direct property modification', () => {
    const original = { foo: 'bar' };
    const proxy = createReadOnlyProxy(original);

    proxy.foo = 'baz';

    expect(original.foo).toBe('bar');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Attempted to modify state.foo during timeout')
    );
  });

  it('should prevent nested property modification', () => {
    const original = { nested: { value: 123 } };
    const proxy = createReadOnlyProxy(original);

    proxy.nested.value = 456;

    expect(original.nested.value).toBe(123);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Attempted to modify state.nested.value during timeout'
      )
    );
  });

  it('should prevent array mutations via push', () => {
    const original = { items: [1, 2, 3] };
    const proxy = createReadOnlyProxy(original);

    proxy.items.push(4);

    expect(original.items).toEqual([1, 2, 3]);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('should prevent array index assignment', () => {
    const original = { items: [1, 2, 3] };
    const proxy = createReadOnlyProxy(original);

    proxy.items[0] = 999;

    expect(original.items[0]).toBe(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Attempted to modify state.items.0 during timeout')
    );
  });

  it('should prevent property deletion', () => {
    const original: { foo?: string } = { foo: 'bar' };
    const proxy = createReadOnlyProxy(original);

    delete proxy.foo;

    expect(original.foo).toBe('bar');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Attempted to delete state.foo during timeout')
    );
  });

  it('should prevent adding new properties', () => {
    const original: { foo: string; bar?: string } = { foo: 'bar' };
    const proxy = createReadOnlyProxy(original);

    proxy.bar = 'baz';

    expect(original.bar).toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Attempted to modify state.bar during timeout')
    );
  });

  it('should handle deeply nested objects', () => {
    const original = {
      level1: {
        level2: {
          level3: {
            value: 'deep',
          },
        },
      },
    };
    const proxy = createReadOnlyProxy(original);

    proxy.level1.level2.level3.value = 'modified';

    expect(original.level1.level2.level3.value).toBe('deep');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Attempted to modify state.level1.level2.level3.value during timeout'
      )
    );
  });

  it('should use custom path in warning messages', () => {
    const original = { foo: 'bar' };
    const proxy = createReadOnlyProxy(original, 'adapter.state');

    proxy.foo = 'baz';

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Attempted to modify adapter.state.foo')
    );
  });

  it('should return the same proxy for the same nested object', () => {
    const original = { nested: { value: 123 } };
    const proxy = createReadOnlyProxy(original);

    const nested1 = proxy.nested;
    const nested2 = proxy.nested;

    expect(nested1).toBe(nested2);
  });

  it('should handle null values in nested objects', () => {
    const original: { nested: { value: string | null } } = {
      nested: { value: null },
    };
    const proxy = createReadOnlyProxy(original);

    expect(proxy.nested.value).toBeNull();
  });

  it('should handle primitive return values correctly', () => {
    const original = {
      string: 'hello',
      number: 42,
      boolean: true,
      undefined: undefined,
    };
    const proxy = createReadOnlyProxy(original);

    expect(proxy.string).toBe('hello');
    expect(proxy.number).toBe(42);
    expect(proxy.boolean).toBe(true);
    expect(proxy.undefined).toBeUndefined();
  });
});
