import { AirdropEvent } from '../types/extraction';
import { RecordManagerExternalSystemSpecifier } from './record-manager.interfaces';

/**
 * Builds the external_system_specifier every record-manager request requires,
 * from fields already present on EventContext.
 */
export function buildExternalSystemSpecifierFromEvent(
  event: AirdropEvent
): RecordManagerExternalSystemSpecifier {
  const eventContext = event.payload.event_context;

  return {
    external_system_type: eventContext.external_system_type,
    external_system_name: eventContext.external_system_name,
    external_system_id: eventContext.external_system_id,
    import_slug: eventContext.import_slug,
    snap_in_slug: eventContext.snap_in_slug,
  };
}
