import { AirdropEvent, EventType, ExtractorEventType } from '../src/types';
import { Adapter } from '../src/adapter';
import { Uploader } from '../src/uploader';
import { DemoExtractor } from '../src/demo-extractor';
import { createAirdropEvent } from './test-helpers';

jest.mock('../src/adapter');
jest.mock('../src/uploader');

describe('DemoExtractor', () => {
  let adapterMock: jest.Mocked<Adapter>;
  let uploaderMock: jest.Mocked<Uploader>;
  let demoExtractor: DemoExtractor;

  beforeEach(() => {
    adapterMock = new Adapter({} as AirdropEvent) as jest.Mocked<Adapter>;
    uploaderMock = new Uploader('', '') as jest.Mocked<Uploader>;
    (Adapter as jest.Mock<Adapter>).mockImplementation(() => adapterMock);
    (Uploader as jest.Mock<Uploader>).mockImplementation(() => uploaderMock);
    demoExtractor = new DemoExtractor();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be able to create an instance of DemoExtractor', () => {
    expect(demoExtractor).toBeInstanceOf(DemoExtractor);
  });

  it('should emit ExtractionExternalSyncUnitsDone when EventType is ExtractionExternalSyncUnitsStart', async () => {
    const event = createAirdropEvent(
      EventType.ExtractionExternalSyncUnitsStart
    );
    await demoExtractor.run(event);
    expect(adapterMock.emit).toHaveBeenCalledWith(
      ExtractorEventType.ExtractionExternalSyncUnitsDone,
      expect.objectContaining({
        external_sync_units: [
          {
            id: 'devrev',
            name: 'devrev',
            description: 'Loopback for DevRev',
            item_count: 0,
          },
        ],
      })
    );
  });

  it('should emit ExtractionMetadataDone when metadata is uploaded successfully', async () => {
    const event = createAirdropEvent(EventType.ExtractionMetadataStart);
    const artifact = { id: 'id', item_type: 'item_type', item_count: 1 };

    uploaderMock.upload.mockResolvedValueOnce({ artifact, error: undefined });

    await demoExtractor.run(event);

    expect(adapterMock.update).toHaveBeenCalledWith({ artifact });
    expect(adapterMock.emit).toHaveBeenCalledWith(
      ExtractorEventType.ExtractionMetadataDone
    );
  });

  it("should emit ExtractionMetadataError when there's an error uploading metadata", async () => {
    const event = createAirdropEvent(EventType.ExtractionMetadataStart);
    const error = new Error('Failed to upload metadata');

    uploaderMock.upload.mockResolvedValueOnce({ artifact: undefined, error });

    await demoExtractor.run(event);

    expect(adapterMock.emit).toHaveBeenCalledWith(
      ExtractorEventType.ExtractionMetadataError,
      { error }
    );
  });

  it('should emit ExtractionDataProgress when data is uploaded successfully', async () => {
    const event = createAirdropEvent(EventType.ExtractionDataStart);
    const artifact = { id: 'id', item_type: 'item_type', item_count: 1 };

    uploaderMock.upload.mockResolvedValueOnce({ artifact, error: undefined });

    await demoExtractor.run(event);

    expect(adapterMock.update).toHaveBeenCalledWith({ artifact });
    expect(adapterMock.emit).toHaveBeenCalledWith(
      ExtractorEventType.ExtractionDataProgress,
      { progress: 50 }
    );
  });

  it('should emit ExtractionDataDone when data is uploaded successfully', async () => {
    const event = createAirdropEvent(EventType.ExtractionDataContinue);
    const artifact = { id: 'id', item_type: 'item_type', item_count: 1 };

    uploaderMock.upload
      .mockResolvedValueOnce({ artifact, error: undefined }) // First call to upload (users data)
      .mockResolvedValueOnce({ artifact, error: undefined }); // Second call to upload (recipe.json)

    await demoExtractor.run(event);

    expect(adapterMock.update).toHaveBeenCalledTimes(2);
    expect(adapterMock.update).toHaveBeenCalledWith({ artifact });
    expect(adapterMock.emit).toHaveBeenCalledWith(
      ExtractorEventType.ExtractionDataDone,
      { progress: 100 }
    );
  });

  it("should emit ExtractionDataError when there's an error uploading data", async () => {
    const event = createAirdropEvent(EventType.ExtractionDataStart);
    const error = new Error('Failed to upload data');

    uploaderMock.upload.mockResolvedValueOnce({ artifact: undefined, error });

    await demoExtractor.run(event);

    expect(adapterMock.emit).toHaveBeenCalledWith(
      ExtractorEventType.ExtractionDataError,
      { error }
    );
  });

  it('should emit ExtractionAttachmentsDone when attachments are uploaded successfully', async () => {
    const event = createAirdropEvent(EventType.ExtractionAttachmentsStart);
    const artifact = { id: 'id', item_type: 'item_type', item_count: 1 };

    uploaderMock.upload.mockResolvedValueOnce({ artifact, error: undefined });

    await demoExtractor.run(event);

    expect(adapterMock.update).toHaveBeenCalledWith({ artifact });
    expect(adapterMock.emit).toHaveBeenCalledWith(
      ExtractorEventType.ExtractionAttachmentsProgress
    );
  });

  it("should emit ExtractionAttachmentsError when there's an error uploading attachments", async () => {
    const event = createAirdropEvent(EventType.ExtractionAttachmentsStart);
    const error = new Error('Failed to upload attachment');

    uploaderMock.upload.mockResolvedValueOnce({ artifact: undefined, error });

    await demoExtractor.run(event);

    expect(adapterMock.emit).toHaveBeenCalledWith(
      ExtractorEventType.ExtractionAttachmentsError,
      { error }
    );
  });
});
