import { ExtractorEventType, NormalizedItem, processTask, RepoInterface } from '../../index';
import { Item } from '../../repo/repo.interfaces';

const repos: RepoInterface[] = [
  {
    itemType: 'tasks',
    overridenOptions: { batchSize: 10 },
    normalize: (task: Item): NormalizedItem => ({
      id: task.id,
      created_date: task.created_at,
      modified_date: task.updated_at,
      data: { name: task.name },
    }),
  },
];

processTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);

    const tasks = Array.from({ length: 15 }, (_, i) => ({
      id: `task_${i}`,
      name: `Task ${i}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await adapter.getRepo('tasks')?.push(tasks);
    await adapter.emit(ExtractorEventType.DataExtractionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.DataExtractionProgress);
  },
});
