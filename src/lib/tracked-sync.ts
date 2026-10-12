import {
  finishSyncRun,
  startSyncRun,
  type SyncRunResult,
  type SyncTrigger,
} from './sync-runs';

export interface SyncTracker {
  start(platform: string, trigger: SyncTrigger): Promise<number>;
  finish(id: number, result: SyncRunResult): Promise<void>;
}

export interface TrackedOperationResult<T> {
  value: T;
  recordsSeen: number;
  recordsWritten: number;
}

export interface TrackedSyncOptions {
  platform: string;
  trigger: SyncTrigger;
  tracker?: SyncTracker;
}

interface CountedError extends Error {
  recordsSeen?: number;
  recordsWritten?: number;
}

const defaultTracker: SyncTracker = {
  start: startSyncRun,
  finish: finishSyncRun,
};

export async function runTrackedSync<T>(
  options: TrackedSyncOptions,
  operation: () => Promise<TrackedOperationResult<T>>,
): Promise<{ runId: number; value: T }> {
  const tracker = options.tracker || defaultTracker;
  const runId = await tracker.start(options.platform, options.trigger);
  try {
    const result = await operation();
    await tracker.finish(runId, {
      status: 'success',
      recordsSeen: result.recordsSeen,
      recordsWritten: result.recordsWritten,
    });
    return { runId, value: result.value };
  } catch (error) {
    const countedError = (error instanceof Error ? error : new Error(String(error))) as CountedError;
    await tracker.finish(runId, {
      status: 'failed',
      recordsSeen: countedError.recordsSeen || 0,
      recordsWritten: countedError.recordsWritten || 0,
      errorMessage: countedError.message,
    });
    throw error;
  }
}
