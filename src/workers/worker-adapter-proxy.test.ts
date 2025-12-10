
import { AsyncLocalStorage } from 'node:async_hooks';
import { WorkerAdapter } from './worker-adapter';
import { createWorkerAdapter } from './worker-adapter';
import { runWithSdkLogContext, getSdkLogContextValue } from '../logger/logger.context';
import { State } from '../state/state';

// We need to mock inner internals to avoid full initialization unless necessary, 
// but we want to check context propagation from public methods.

jest.mock('../common/control-protocol', () => ({
    emit: jest.fn().mockResolvedValue({}),
}));
jest.mock('node:worker_threads', () => ({
    parentPort: { postMessage: jest.fn() }
}));
jest.mock('../uploader/uploader', () => ({
    Uploader: jest.fn().mockImplementation(() => ({
        getJsonObjectByArtifactId: jest.fn(),
        getAttachmentsFromArtifactId: jest.fn(),
    }))
}));
jest.mock('../mappers/mappers', () => ({
    Mappers: jest.fn().mockImplementation(() => ({}))
}));


describe('WorkerAdapter Log Context Proxy', () => {
    let mockEvent;
    let mockAdapterState;
    let adapterInstance: WorkerAdapter<any>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockEvent = {
            context: {
                secrets: { service_account_token: 'token' },
                snap_in_version_id: 'v1',
                snap_in_id: 'id'
            },
            payload: {
                event_type: 'test',
                event_context: { sync_unit: 'test' },
                connection_data: {
                    org_id: 'org_1',
                    org_name: 'test',
                    key: 'key',
                    key_type: 'type'
                }
            },
            execution_metadata: { devrev_endpoint: 'url' },
            input_data: {}
        } as any;
        mockAdapterState = new State<any>({
            event: mockEvent,
            initialState: {},
        });

        // Use the factory to get the proxied instance
        adapterInstance = createWorkerAdapter({
            event: mockEvent,
            adapterState: mockAdapterState,
        });
    });

    it('should be an instance of WorkerAdapter', () => {
        // This confirms the createWorkerAdapter returns something compatible with WorkerAdapter type
        // Note: `instanceof` on Proxy might behave trickily depending on target, but `createWorkerAdapter` returns `WorkerAdapter`.
        // The PoC showed it might require explicit care if strict `instanceof` is needed, but for TS type compatibility it's fine.
        // Let's check runtime behavior.
        // Actually, the generic Proxy `instanceof` check works if the target is the class instance.

        // However, if strict instanceof is important for the User's codebase, this test validates it.
        // Our PoC showed it works.
        expect(adapterInstance).toBeInstanceOf(WorkerAdapter);
    });

    it('should wrap async methods in SDK log context', async () => {
        let contextValue: boolean | undefined;

        // Overwrite the method on the instance (target).
        // The proxy will intercept the get, wrap this new function, and execute it in context.
        // This validates the Proxy mechanism itself.
        adapterInstance.loadItemTypes = async (params) => {
            contextValue = getSdkLogContextValue(false);
            return { reports: [], processed_files: [] };
        };

        await adapterInstance.loadItemTypes({ itemTypesToLoad: [] });

        expect(contextValue).toBe(true);
    });

    it('should wrap sync methods in SDK log context', () => {
        let contextValue: boolean | undefined;

        adapterInstance.initializeRepos = (repos: any) => {
            contextValue = getSdkLogContextValue(false);
        };

        adapterInstance.initializeRepos([]);
        expect(contextValue).toBe(true);
    });

    it('should propagate context through method calls', async () => {
        // To verify propagation/nesting implies we rely on the implementation calling another method.
        // But since we proved the wrapper works, and AsyncLocalStorage propagates automatically (verified in logger.context tests presumably),
        // we might not strictly need this if we trust AsyncLocalStorage.
        // However, if we want to be sure `this` is bound correctly so internal calls also go through proxy?
        // Actually, internal calls like `this.otherMethod()`:
        // If `this` in the wrapper is bound to the *instance* (target), then `this.otherMethod` access will NOT go through proxy?
        // Wait.
        // In the proxy handler:
        // wrapper is: `return runWithSdkLogContext(() => value.apply(this, args));`
        // `value` is the function from the target.
        // `this` is...
        // `get(target, prop, receiver)` -> `Reflect.get(target, prop, receiver)`
        // If I call `proxy.method()`, `receiver` is the proxy.
        // `Reflect.get` returns the property value. If it's a getter, it runs with `this=receiver`.
        // If it's a plain value (function), it just returns the function.
        // Then I call the function: `wrapper.apply(this, args)`.
        // Who calls the wrapper? `proxy.method(...)`.
        // So `this` passed to wrapper is the Proxy? No?
        // `const m = proxy.method; m();` -> `this` is undefined/global.
        // `proxy.method()` -> `this` is proxy.
        //
        // My wrapper definition:
        // `return function (this: any, ...args: any[]) { return runWithSdkLogContext(() => value.apply(this, args)); };`
        // When I call `proxy.method()`, `this` inside the wrapper is the proxy.
        // Then `value.apply(this, args)` calls the original method with `this` = proxy.
        // So inside the original method, `this` is the proxy.
        // So `this.otherMethod()` calls `proxy.otherMethod()`.
        // So it SHOULD go through the proxy again (double wrapping).
        //
        // Let's verify this behavior because it's important for consistency (though double wrapping is harmless context-wise).

        // We need to overwrite `loadItemTypes` to call `this.someOtherMethod()`.
        // But `loadItemTypes` is on the target. If I overwrite it on the target, I can make it call `this.otherMethod()`.

        let innerCalled = false;

        // Define a dummy method on the instance to be called
        // We can't add new properties to safety/types usually, but JS allows it.
        // Or reuse an existing one like `getLoaderBatches`.

        adapterInstance.getLoaderBatches = async () => {
            innerCalled = true;
            // Check if context is true here too (it should be)
            expect(getSdkLogContextValue(false)).toBe(true);
            return [];
        };

        // Overwrite the outer method to call the inner method via `this`
        adapterInstance.loadItemTypes = async function (this: WorkerAdapter<any>) {
            // 'this' should be the proxy
            return this.getLoaderBatches({ supportedItemTypes: [] });
        } as any;

        await adapterInstance.loadItemTypes({ itemTypesToLoad: [] });

        expect(innerCalled).toBe(true);
    });
});
