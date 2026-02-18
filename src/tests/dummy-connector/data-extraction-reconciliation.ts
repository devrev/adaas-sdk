import {
  ExtractorEventType,
  NormalizedItem,
  processTask,
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

// Create test data spanning multiple months for reconciliation testing
const createTestDataWithTimestamps = () => {
  const tasks = [];

  // Create 10 tasks for each month: Jan, Feb, Mar 2024
  const months = [
    { month: '01', days: 31 },
    { month: '02', days: 29 }, // 2024 is a leap year
    { month: '03', days: 31 },
  ];

  let taskId = 0;
  for (const { month, days } of months) {
    for (let day = 1; day <= Math.min(days, 10); day++) {
      const date = `2024-${month}-${String(day).padStart(2, '0')}T${String(
        taskId % 24
      ).padStart(2, '0')}:00:00Z`;
      tasks.push({
        id: `task_2024_${month}_${day}_${taskId}`,
        name: `Task 2024-${month}-${day}`,
        description: `Description for task on 2024-${month}-${day}`,
        created_at: date,
        updated_at: date,
      });
      taskId++;
    }
  }

  return tasks;
};

/**
 * Filters tasks to only those within the reconciliation range.
 * This simulates what a real connector would do when extraction_time_direction = reconciliation.
 */
const filterTasksByReconciliationRange = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[],
  rangeStart: string | undefined,
  rangeEnd: string | undefined
) => {
  if (!rangeStart || !rangeEnd) {
    return tasks;
  }

  const startTime = new Date(rangeStart).getTime();
  const endTime = new Date(rangeEnd).getTime();

  return tasks.filter((task) => {
    const taskTime = new Date(task.created_at).getTime();
    return taskTime >= startTime && taskTime <= endTime;
  });
};

processTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);

    const allTasks = createTestDataWithTimestamps();

    // Check if this is a reconciliation run
    const rangeStart =
      adapter.event.payload.event_context.extraction_range_start;
    const rangeEnd = adapter.event.payload.event_context.extraction_range_end;

    const tasksToExtract = filterTasksByReconciliationRange(
      allTasks,
      rangeStart,
      rangeEnd
    );

    await adapter.getRepo('tasks')?.push(tasksToExtract);
    await adapter.emit(ExtractorEventType.DataExtractionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.DataExtractionProgress);
  },
});
