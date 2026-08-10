/**
 * ProgressData represents the progress information sent with extraction events.
 * Includes statistics about the last extracted item type and calculated time ranges.
 */
export interface ProgressData {
  // Last extracted item type statistics
  item_type?: string;
  oldest_created_date?: string;
  newest_created_date?: string;
  oldest_modified_date?: string;
  newest_modified_date?: string;

  // Calculated time ranges in absolute times
  oldest_state_date?: string;
  newest_state_date?: string;
}
