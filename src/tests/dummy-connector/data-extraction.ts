import {
  NormalizedItem,
  processExtractionTask,
  RepoInterface,
} from '../../index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeTask = (task: any): NormalizedItem => {
  return {
    id: task.id,
    created_date: task.created_at,
    modified_date: task.updated_at,
    data: {
      name: task.name,
      description: task.description,
    },
  };
};

const repos: RepoInterface[] = [
  {
    itemType: 'tasks',
    normalize: normalizeTask,
  },
];

processExtractionTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);

    const tasks = [];

    for (let i = 0; i < 10; i++) {
      const task = {
        id: `task_${i}`,
        name: `Task ${i}`,
        description: `Description ${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      tasks.push(task);
    }

    await adapter.getRepo('tasks')?.push(tasks);
    return { status: 'success' };
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    return { status: 'progress' };
  },
});
