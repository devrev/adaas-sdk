import type { EventContext, EventData } from '../types/extraction';

type TraceAttributeValue = string | number | boolean;

function pickString(
  source: Record<string, unknown> | undefined,
  key: string
): TraceAttributeValue | undefined {
  const value = source?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function pickNumber(
  source: Record<string, unknown> | undefined,
  key: string
): TraceAttributeValue | undefined {
  const value = source?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function pickBoolean(
  source: Record<string, unknown> | undefined,
  key: string
): TraceAttributeValue | undefined {
  const value = source?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function pickCount<T>(value: T[] | undefined): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

export function summarizeEventContext(
  eventContext?: EventContext
): Record<string, TraceAttributeValue> {
  if (!eventContext) {
    return {};
  }

  const context = eventContext as unknown as Record<string, unknown>;
  return {
    ...(pickString(context, 'callback_url')
      ? { callback_url: pickString(context, 'callback_url')! }
      : {}),
    ...(pickString(context, 'dev_oid')
      ? { dev_oid: pickString(context, 'dev_oid')! }
      : {}),
    ...(pickString(context, 'dev_org_id')
      ? { dev_org_id: pickString(context, 'dev_org_id')! }
      : {}),
    ...(pickString(context, 'dev_uid')
      ? { dev_uid: pickString(context, 'dev_uid')! }
      : {}),
    ...(pickString(context, 'external_sync_unit_id')
      ? { external_sync_unit_id: pickString(context, 'external_sync_unit_id')! }
      : {}),
    ...(pickString(context, 'external_sync_unit_name')
      ? {
          external_sync_unit_name: pickString(
            context,
            'external_sync_unit_name'
          )!,
        }
      : {}),
    ...(pickString(context, 'external_system_id')
      ? { external_system_id: pickString(context, 'external_system_id')! }
      : {}),
    ...(pickString(context, 'external_system_name')
      ? { external_system_name: pickString(context, 'external_system_name')! }
      : {}),
    ...(pickString(context, 'external_system_type')
      ? { external_system_type: pickString(context, 'external_system_type')! }
      : {}),
    ...(pickString(context, 'event_type_adaas')
      ? { event_type_adaas: pickString(context, 'event_type_adaas')! }
      : {}),
    ...(pickString(context, 'import_slug')
      ? { import_slug: pickString(context, 'import_slug')! }
      : {}),
    ...(pickString(context, 'mode')
      ? { mode: pickString(context, 'mode')! }
      : {}),
    ...(pickString(context, 'request_id')
      ? { request_id: pickString(context, 'request_id')! }
      : {}),
    ...(pickString(context, 'request_id_adaas')
      ? { request_id_adaas: pickString(context, 'request_id_adaas')! }
      : {}),
    ...(pickString(context, 'run_id')
      ? { run_id: pickString(context, 'run_id')! }
      : {}),
    ...(pickString(context, 'sequence_version')
      ? { sequence_version: pickString(context, 'sequence_version')! }
      : {}),
    ...(pickString(context, 'snap_in_slug')
      ? { snap_in_slug: pickString(context, 'snap_in_slug')! }
      : {}),
    ...(pickString(context, 'snap_in_version_id')
      ? { snap_in_version_id: pickString(context, 'snap_in_version_id')! }
      : {}),
    ...(pickString(context, 'sync_tier')
      ? { sync_tier: pickString(context, 'sync_tier')! }
      : {}),
    ...(pickString(context, 'sync_unit_id')
      ? { sync_unit_id: pickString(context, 'sync_unit_id')! }
      : {}),
    ...(pickString(context, 'worker_data_url')
      ? { worker_data_url: pickString(context, 'worker_data_url')! }
      : {}),
    ...(pickString(context, 'extract_from')
      ? { extract_from: pickString(context, 'extract_from')! }
      : {}),
    ...(pickString(context, 'extract_to')
      ? { extract_to: pickString(context, 'extract_to')! }
      : {}),
    ...(pickBoolean(context, 'reset_extract_from') !== undefined
      ? { reset_extract_from: pickBoolean(context, 'reset_extract_from')! }
      : {}),
  };
}

export function summarizeEventData(
  eventData?: EventData
): Record<string, TraceAttributeValue> {
  if (!eventData) {
    return {};
  }

  const data = eventData as Record<string, unknown>;
  return {
    ...(pickCount(eventData.external_sync_units) !== undefined
      ? { external_sync_unit_count: pickCount(eventData.external_sync_units)! }
      : {}),
    ...(pickNumber(data, 'progress') !== undefined
      ? { progress: pickNumber(data, 'progress')! }
      : {}),
    ...(pickNumber(data, 'delay') !== undefined
      ? { delay: pickNumber(data, 'delay')! }
      : {}),
    ...(pickCount(eventData.artifacts) !== undefined
      ? { artifact_count: pickCount(eventData.artifacts)! }
      : {}),
    ...(pickCount(eventData.reports) !== undefined
      ? { report_count: pickCount(eventData.reports)! }
      : {}),
    ...(pickCount(eventData.processed_files) !== undefined
      ? { processed_file_count: pickCount(eventData.processed_files)! }
      : {}),
    ...(typeof eventData.stats_file === 'string' &&
    eventData.stats_file.length > 0
      ? { stats_file_present: true }
      : {}),
    ...(eventData.error?.message
      ? { error_message: eventData.error.message }
      : {}),
    ...(eventData.error ? { has_error: true } : {}),
    ...(Object.keys(data).length
      ? { event_data_keys: Object.keys(data).sort().join(',') }
      : {}),
  };
}
