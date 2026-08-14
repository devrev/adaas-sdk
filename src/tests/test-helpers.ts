import { Readable } from 'stream';

import { AxiosResponse } from 'axios';

import {
  Item,
  NormalizedAttachment,
  NormalizedItem,
} from '../repo/repo.interfaces';
import { ArtifactToUpload } from '../uploader/uploader.interfaces';

import { CreateFileStreamOptions } from './test-helpers.interfaces';

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

export function createDownloadUrlResponse(
  downloadUrl = 'https://s3.example.com/download'
) {
  return {
    data: { download_url: downloadUrl },
  };
}

export function createFileBuffer(content = 'test file content'): Buffer {
  return Buffer.from(content);
}

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
 * Calls a private method on an instance. Curried so the private-method map is
 * supplied as a type parameter: callPrivateMethod<T>()(instance, 'method').
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

export function spyOnPrivateMethod<TPrivateMethods>(
  instance: object,
  methodName: keyof TPrivateMethods
): jest.SpyInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jest.spyOn(instance as any, methodName as string);
}
