import axios from 'axios';

import {
  Artifact,
  AirdropEvent,
  ExtractorEventType,
  ExtractorEvent,
  EventData,
} from '../types';

import { AdapterUpdateParams } from '../types/common';
import { getTimeoutExtractorEventType } from '../adapter/helpers';

/**
 * Adapter class is used to interact with Airdrop platform. The class provides
 * utilities to
 *  - emit control events to the platform
 *  - update the state of the extractor
 *  - add artifacts to the list of artifacts to be returned to the platform
 *  - Return the last saved state and artifacts in case timeout
 *  - The event sent in case of timeout for each event type is as follows:
 *     - EXTRACTION_EXTERNAL_SYNC_UNITS_START =>  EXTRACTION_EXTERNAL_SYNC_UNITS_ERROR
 *     - EXTRACTION_METADATA_START => EXTRACTION_METADATA_ERROR
 *     - EXTRACTION_DATA_START => EXTRACTION_DATA_PROGRESS
 *     - EXTRACTION_DATA_CONTINUE => EXTRACTION_DATA_PROGRESS
 *     - EXTRACTION_ATTACHMENTS_START => EXTRACTION_ATTACHMENTS_PROGRESS
 *     - EXTRACTION_ATTACHMENTS_CONTINUE => EXTRACTION_ATTACHMENTS_PROGRESS
 *
 * @class Adapter
 * @constructor
 * @param {AirdropEvent} event - The event object received from the platform
 * @param {object=} state - Optional state object to be passed to the extractor. If not provided, an empty object is used.
 */
export class Adapter {
  private artifacts: Artifact[];
  /** Adapter level state to return to the platform */
  private extractorState: object;

  private event: AirdropEvent;
  private callbackUrl: string;
  private devrevToken: string;

  constructor(event: AirdropEvent, state?: object) {
    this.event = event;
    this.artifacts = [];

    this.extractorState = state || {};

    this.callbackUrl = event.payload.event_context.callback_url;
    this.devrevToken = event.context.secrets["service_account_token"];

    // Once lambda is near to timeout, Snap-in needs to submit the information about artifacts
    // that have been uploaded and state, so next time it is run, can continue where it has left off
    setTimeout(
      async () => {
        const extractorEventType = getTimeoutExtractorEventType(
          this.event.payload.event_type
        );

        if (extractorEventType) {
          await this.emit(extractorEventType, { artifacts: this.artifacts });
        }
      },
      12 * 60 * 1000
    );
  }

  /**
   *  Adds artifact to the list of artifacts.
   *  Overrides extractor state if provided.
   *
   * @param {AdapterUpdateParams} params - The parameters to update the adapter
   * @param {Artifact=} params.artifact - The artifact to be added to the list of artifacts
   * @param {object=} params.extractor_state - The state object to be updated
   */
  async update(params: AdapterUpdateParams) {
    if (params.artifact) {
      this.artifacts.push(params.artifact);
    }

    if (params.extractor_state) {
      this.extractorState = params.extractor_state;
    }
  }

  /**
   *  Emits an event to the platform.
   *
   * @param {ExtractorEventType} newEventType - The event type to be emitted
   * @param {EventData=} data - The data to be sent with the event
   */
  async emit(newEventType: ExtractorEventType, data?: EventData) {
    const newEvent: ExtractorEvent = {
      extractor_state: JSON.stringify(this.extractorState),
      event_type: newEventType,
      event_context: {
        uuid: this.event.payload.event_context.uuid,
        sync_run: this.event.payload.event_context.sync_run_id,
    },
      event_data: {
        ...data,
        artifacts: this.artifacts,
      },
    };

    // If sync_unit_id is present in the event, add it to the new event
    if (this.event.payload.event_context.sync_unit_id) {
      newEvent.event_context.sync_unit =
        this.event.payload.event_context.sync_unit_id;
    }
    console.log('Event that will be emitted: ' + JSON.stringify(newEvent));

    try {
      await axios.post(
        this.callbackUrl,
        { ...newEvent },
        {
          headers: {
            Accept: 'application/json, text/plain, */*',
            Authorization: this.devrevToken,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      // If this request fails the extraction will be stuck in loop and
      // we need to stop it through UI or think about retrying this request
      console.log(
        'Emitting failed for this event: ' +
          JSON.stringify(newEvent) +
          ', error: ' +
          error
      );
    }
  }

  /**
   *  Returns the list of artifacts stored in the adapter.
   *
   * @return  The list of artifacts
   */
  getArtifacts(): Artifact[] {
    return this.artifacts;
  }
}
