import { processTask, ExtractorEventType } from '../../index';
import { Uploader } from '../../uploader/uploader';

const repos = [
  {
    itemType: 'ssor_attachment',
  },
];

processTask({
  task: async ({ adapter }) => {
    if (
      !adapter.state.toDevRev?.attachmentsMetadata.artifactIds ||
      adapter.state.toDevRev.attachmentsMetadata.artifactIds.length === 0
    ) {
      console.log('No attachments to extract, skipping.');
      await adapter.emit(ExtractorEventType.ExtractionAttachmentsDone);
      return;
    }

    adapter.initializeRepos(repos);
    const uploader = new Uploader({
      event: adapter.event,
      options: adapter.options,
    });

    for (const attachmentsMetadataArtifactId of adapter.state.toDevRev
      ?.attachmentsMetadata.artifactIds) {
      const { ssorAttachments, error } = await uploader.streamAttachments({
        attachmentsMetadataArtifactId,
      });

      if (error || !ssorAttachments) {
        await adapter.emit(ExtractorEventType.ExtractionAttachmentsError, {
          error,
        });
        return;
      }

      await adapter.getRepo('ssor_attachment')?.push(ssorAttachments);
      adapter.state.toDevRev?.attachmentsMetadata.artifactIds.shift();
      adapter.state.toDevRev.attachmentsMetadata.lastProcessed = 0;

      if (
        adapter.state.toDevRev?.attachmentsMetadata.artifactIds.length === 0
      ) {
        break;
      }
    }

    await adapter.emit(ExtractorEventType.ExtractionAttachmentsDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.postState();
    await adapter.emit(ExtractorEventType.ExtractionAttachmentsProgress, {
      progress: 50,
    });
  },
});
