import { AxiosResponse } from 'axios';
import { Readable } from 'stream';

import {
  Item,
  NormalizedAttachment,
  NormalizedItem,
} from '../repo/repo.interfaces';
import { createEvent as createEventBase } from '../test-utils/create-event';
import { AirdropEvent } from '../types/extraction';
import { ArtifactToUpload } from '../uploader/uploader.interfaces';

import { mockServer } from './jest.setup';
import {
  CreateEventInterface,
  CreateFileStreamOptions,
} from './test-helpers.interfaces';

/**
 * Internal convenience wrapper around the public {@link createEventBase} that
 * automatically injects the shared `mockServer.baseUrl`.  All existing test
 * call-sites remain unchanged.
 */
export function createEvent(params: CreateEventInterface = {}): AirdropEvent {
  return createEventBase({
    mockServerBaseUrl: mockServer.baseUrl,
    ...params,
  });
}

export function createItem(id: number): Item {
  return {
    id,
    created_at: '2021-01-01',
    updated_at: '2021-01-01',
    name: 'item' + id,
  };
}

export function createItems(count: number): Item[] {
  return Array.from({ length: count }, (_, index) => createItem(index));
}

export function normalizeItem(item: Item): NormalizedItem {
  return {
    id: item.id,
    created_date: item.created_at,
    modified_date: item.updated_at,
    data: {
      name: item.name,
    },
  };
}

export function createAttachment(id: number): NormalizedAttachment {
  return {
    id: id.toString(),
    url: 'https://test.com/' + id,
    author_id: 'author' + id,
    file_name: 'file' + id,
    parent_id: 'parent' + id,
  };
}

export function createAttachments(count: number): NormalizedAttachment[] {
  return Array.from({ length: count }, (_, index) => createAttachment(index));
}

/**
 * Creates a mock artifact object for testing upload flows.
 * Use the `overrides` parameter to customize specific fields for your test case.
 */
export function createArtifact(
  overrides: Partial<ArtifactToUpload> = {}
): ArtifactToUpload {
  return {
    artifact_id: 'art_123',
    upload_url: 'https://s3.example.com/upload',
    form_data: [],
    ...overrides,
  };
}

/**
 * Creates a mock Axios success response for testing HTTP calls.
 * Use the `overrides` parameter to customize response properties.
 */
export function createAxiosResponse(
  overrides: Partial<AxiosResponse> = {}
): AxiosResponse {
  return {
    status: 200,
    data: { success: true },
    statusText: 'OK',
    headers: {},
    config: {} as AxiosResponse['config'],
    ...overrides,
  } as AxiosResponse;
}

/**
 * Creates a mock download URL response matching the DevRev API format.
 * Used when testing artifact download flows.
 */
export function createDownloadUrlResponse(
  downloadUrl = 'https://s3.example.com/download'
) {
  return {
    data: { download_url: downloadUrl },
  };
}

/**
 * Creates a mock file buffer for testing file upload/download operations.
 * Use the `content` parameter to customize the file content.
 */
export function createFileBuffer(content = 'test file content'): Buffer {
  return Buffer.from(content);
}

/**
 * Creates an AxiosResponse-like object with a Readable stream for testing file streaming operations.
 * Useful for testing upload/download flows that work with streamed file data.
 */
export function createFileStream(
  options: CreateFileStreamOptions = {}
): AxiosResponse {
  const {
    content = 'test file content',
    contentLength,
    includeContentLength = true,
    filename,
    mimeType = 'application/octet-stream',
    destroyFn = () => {},
  } = options;

  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

  const readable = new Readable({
    read() {
      this.push(buffer);
      this.push(null);
    },
  });
  readable.destroy = destroyFn as typeof readable.destroy;

  const headers: Record<string, string | number> = {
    'content-type': mimeType,
  };

  if (includeContentLength) {
    headers['content-length'] = contentLength ?? buffer.length;
  }

  if (filename) {
    headers['content-disposition'] = `attachment; filename="${filename}"`;
  }

  return {
    data: readable,
    headers,
    status: 200,
    statusText: 'OK',
    config: {},
  } as unknown as AxiosResponse;
}

/**
 * Calls a private method on an instance.
 * Use with a type parameter to get the specific method signature.
 *
 * @example
 * type MyClassPrivate = { privateMethod: (x: number) => string };
 * const fn = callPrivateMethod<MyClassPrivate>()(instance, 'privateMethod');
 * const result = fn(42);
 */
export function callPrivateMethod<TPrivateMethods>() {
  return <K extends keyof TPrivateMethods>(
    instance: object,
    methodName: K
  ): TPrivateMethods[K] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (instance as any)[methodName].bind(instance);
  };
}

/**
 * Spies on a private method of an instance.
 *
 * @example
 * type MyClassPrivate = { privateMethod: (x: number) => string };
 * const spy = spyOnPrivateMethod<MyClassPrivate>(instance, 'privateMethod');
 * spy.mockResolvedValueOnce('mocked');
 */
export function spyOnPrivateMethod<TPrivateMethods>(
  instance: object,
  methodName: keyof TPrivateMethods
): jest.SpyInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jest.spyOn(instance as any, methodName as string);
}
