const ERROR_PREFIX = 'ERROR_CODE';
const ERROR_DELIMITER = '=';

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
