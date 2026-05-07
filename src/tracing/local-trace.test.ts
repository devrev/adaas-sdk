import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { createLocalTraceSession, withLocalTraceSpan } from './local-trace';

describe('local trace session', () => {
  it('is a no-op when disabled', async () => {
    const session = await createLocalTraceSession({ enabled: false });

    expect(session.enabled).toBe(false);
    expect(session.outputPath).toBeUndefined();

    await expect(session.withSpan('noop', {}, () => 'ok')).resolves.toBe('ok');
  });

  it('writes span and error records to a file', async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), 'adaas-trace-'));
    const outputPath = path.join(outputDir, 'trace.ndjson');

    const session = await createLocalTraceSession({
      enabled: true,
      outputPath,
    });

    await withLocalTraceSpan(
      'root-span',
      {
        source: {
          file: 'root.ts',
          symbol: 'root',
        },
        attributes: {
          foo: 'bar',
        },
      },
      async (span) => {
        session.markError(new Error('boom'), span);

        await session.withSpan(
          'child-span',
          {
            parentSpanContext: session.getCurrentSpanContext(),
            attributes: {
              baz: 123,
            },
          },
          () => 'child'
        );

        return 'root';
      }
    );

    await session.shutdown();

    const lines = readFileSync(outputPath, 'utf8')
      .trim()
      .split('\n')
      .map(
        (line) => JSON.parse(line) as { type: string; [key: string]: unknown }
      );

    expect(lines.some((line) => line.type === 'session')).toBe(true);
    expect(lines.some((line) => line.type === 'span')).toBe(true);
    expect(lines.some((line) => line.type === 'error')).toBe(true);
    expect(lines.some((line) => line.type === 'session_end')).toBe(true);
  });
});
