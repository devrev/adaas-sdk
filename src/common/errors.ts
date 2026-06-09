/** Prefix used to namespace common error codes emitted by extractors. */
const ERROR_PREFIX = 'ERROR_CODE';
/** Delimiter joining the error prefix and the specific error name in the encoded code. */
const ERROR_DELIMITER = '=';

/**
 * Well-known error codes an extractor can report to signal common, externally-caused failure conditions.
 *
 * Used to communicate persistent source-system states (deletion, deactivation, missing access/permission)
 * or sync-completion signals back to AirSync in a recognized, machine-readable form. Each member's value
 * is the encoded string `ERROR_CODE=<NAME>`.
 */
export const enum ExtractionCommonError {
  // Indicates that the external system is permanently inactive or inaccessible.
  // This is used for persistent conditions (system deleted, deactivated, access permanently revoked)
  // that require stopping periodic syncs, not for temporary issues like network errors or rate limits.
  EXTERNAL_SYNC_UNIT_DELETED = `${ERROR_PREFIX}${ERROR_DELIMITER}EXTERNAL_SYNC_UNIT_DELETED`,
  EXTERNAL_SYNC_UNIT_DEACTIVATED = `${ERROR_PREFIX}${ERROR_DELIMITER}EXTERNAL_SYNC_UNIT_DEACTIVATED`,
  USER_DELETED = `${ERROR_PREFIX}${ERROR_DELIMITER}USER_DELETED`,

  // Indicates insufficient access. Could not find accessible resource in the source system.
  EXTERNAL_SYSTEM_NO_ACCESS = `${ERROR_PREFIX}${ERROR_DELIMITER}EXTERNAL_SYSTEM_NO_ACCESS`,
  // Indicates that the user is missing a required permisson.
  EXTERNAL_SYSTEM_NO_PERMISSION = `${ERROR_PREFIX}${ERROR_DELIMITER}EXTERNAL_SYSTEM_NO_PERMISSION`,
  // Indicates that the historical periodic sync has reached the end and there is no more data to extract.
  HISTORICAL_DATA_EXTRACTION_DONE = `${ERROR_PREFIX}${ERROR_DELIMITER}HISTORICAL_DATA_EXTRACTION_DONE`,
}
