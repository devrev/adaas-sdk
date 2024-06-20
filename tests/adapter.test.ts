import axios from 'axios';
import { Adapter } from '../src/adapter';
import { EventType, ExtractorEventType } from '../src/types';
import { createAirdropEvent } from './test-helpers';

describe('Adapter', () => {
  it('should be able to create an instance of Adapter', () => {
    const event = createAirdropEvent(
      EventType.ExtractionExternalSyncUnitsStart
    );
    const adapter = new Adapter(event);
    expect(adapter).toBeInstanceOf(Adapter);
  });

  describe('update', () => {
    it('should add an artifact to the artifacts array', () => {
      const event = createAirdropEvent(EventType.ExtractionDataStart);
      const adapter = new Adapter(event);
      const artifact = { id: 'id', item_type: 'item_type', item_count: 1 };
      adapter.update({ artifact });
      expect(adapter.getArtifacts()).toContain(artifact);
    });

    it('should not add anything if artifact is not provided', () => {
      const event = createAirdropEvent(EventType.ExtractionDataStart);
      const adapter = new Adapter(event);
      adapter.update({});
      expect(adapter.getArtifacts()).toHaveLength(0);
    });
  });

  describe('emit', () => {
    it('should call axios.post with correct parameters - case without error', async () => {
      const event = createAirdropEvent(EventType.ExtractionDataStart);
      const adapter = new Adapter(event);
      const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValue({});
      const newEventType = ExtractorEventType.ExtractionDataDone;
      await adapter.emit(newEventType);

      expect(axiosSpy).toHaveBeenCalledWith(
        event.payload.event_context.callback_url,
        expect.objectContaining({
          event_type: newEventType,
        }),
        expect.objectContaining({
          headers: {
            Accept: 'application/json, text/plain, */*',
            Authorization: event.context.secrets["service_account_token"],
            'Content-Type': 'application/json',
          },
        })
      );
      axiosSpy.mockRestore();
    });

    it('should call axios.post with correct parameters - case with error', async () => {
      const event = createAirdropEvent(EventType.ExtractionDataStart);
      const adapter = new Adapter(event);
      const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValue({});
      const newEventType = ExtractorEventType.ExtractionDataError;
      const data = {
        error: { message: 'some error message' },
      };
      await adapter.emit(newEventType, data);

      expect(axiosSpy).toHaveBeenCalledWith(
        event.payload.event_context.callback_url,
        expect.objectContaining({
          event_type: newEventType,
          event_data: expect.objectContaining({
            error: data.error,
          }),
        }),
        expect.objectContaining({
          headers: {
            Accept: 'application/json, text/plain, */*',
            Authorization: event.context.secrets["service_account_token"],
            'Content-Type': 'application/json',
          },
        })
      );
      axiosSpy.mockRestore();
    });
  });
});
