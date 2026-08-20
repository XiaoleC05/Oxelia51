import { z } from "zod";
import { eventTypes } from "./ingestion/types";

export const IngestionEvent = z.object({
  data: z.object({
    type: z.enum(Object.values(eventTypes)),
    eventBodyId: z.string(),
    fileKey: z.string().optional(),
    skipS3List: z.boolean().optional(),
    forwardToEventsTable: z.boolean().optional(),
    // Optional for rolling deploy compatibility with in-flight jobs created
    // before ingestion attribution was added to the queue payload.
    ingestionApiKey: z.string().optional(),
    ingestionSdkName: z.string().optional(),
    ingestionSdkVersion: z.string().optional(),
    // Absolute S3 key prefix the producer used (ends with "/"). Set so the
    // consumer never reconstructs the path and therefore can't drift from
    // the producer when env values differ across containers. Optional for
    // backward compatibility with in-flight jobs enqueued before this field
    // existed — the consumer falls back to local reconstruction when absent.
    bucketPrefix: z.string().optional(),
  }),
  authCheck: z.object({
    validKey: z.literal(true),
    scope: z.object({
      projectId: z.string(),
    }),
  }),
});

export const OtelIngestionEvent = z.object({
  data: z.object({
    fileKey: z.string(),
    // Optional for compatibility with queued/replayed payloads that do not
    // carry API-key attribution.
    publicKey: z.string().optional(),
  }),
  authCheck: z.object({
    validKey: z.literal(true),
    scope: z.object({
      projectId: z.string(),
      accessLevel: z.literal("project"),
      orgId: z.string().optional(),
    }),
  }),
  propagatedHeaders: z.record(z.string(), z.string()).optional(),
  // Optional for rolling deploy compatibility with in-flight jobs created
  // before SDK attribution was added to the queue payload.
  sdkName: z.string().optional(),
  sdkVersion: z.string().optional(),
  ingestionVersion: z.string().optional(),
  // Langfuse-internal telemetry (e.g. LLM-as-a-judge / prompt-experiment
  // executions published by the internal AI SDK LLM runtime). The
  // consumer must parse these events with the INTERNAL ingestion schema:
  // the public schema strips the reserved "langfuse-" environment prefix,
  // which would expose internal traces as user environments and bypass the
  // trace-upsert eval-loop guard. Optional for in-flight job compatibility.
  isLangfuseInternal: z.boolean().optional(),
});

export const BatchExportJobSchema = z.object({
  projectId: z.string(),
  batchExportId: z.string(),
});
export const CloudSpendAlertJobSchema = z.object({
  orgId: z.string(),
});
export const TraceQueueEventSchema = z.object({
  projectId: z.string(),
  traceId: z.string(),
  exactTimestamp: z.date().optional(),
  traceEnvironment: z.string().optional(), // Optional to maintain backward compatibility with existing jobs in queue during deployment. 'optional()' can be removed after queue was exhausted
});
export const TracesQueueEventSchema = z.object({
  projectId: z.string(),
  traceIds: z.array(z.string()),
});
export const ScoresQueueEventSchema = z.object({
  projectId: z.string(),
  scoreIds: z.array(z.string()),
});
export const DatasetQueueEventSchema = z.discriminatedUnion("deletionType", [
  // Delete all run items for a specific dataset
  z.object({
    deletionType: z.literal("dataset"),
    projectId: z.string(),
    datasetId: z.string(),
  }),
  // Delete all run items for multiple dataset runs (also used for single run deletion)
  z.object({
    deletionType: z.literal("dataset-runs"),
    projectId: z.string(),
    datasetId: z.string(),
    datasetRunIds: z.array(z.string()),
  }),
]);
export const ProjectQueueEventSchema = z.object({
  projectId: z.string(),
  orgId: z.string(),
});
export const DatasetRunItemUpsertEventSchema = z.object({
  projectId: z.string(),
  datasetItemId: z.string(),
  datasetItemValidFrom: z.date().optional(), // Exact valid_from value from DB (internally controlled)
  traceId: z.string(),
  observationId: z.string().optional(),
});
export const EvalExecutionEvent = z.object({
  projectId: z.string(),
  jobExecutionId: z.string(),
  delay: z.number().nullish(),
});

export const PostHogIntegrationProcessingEventSchema = z.object({
  projectId: z.string(),
});
export const MixpanelIntegrationProcessingEventSchema = z.object({
  projectId: z.string(),
});
export const BlobStorageIntegrationProcessingEventSchema = z.object({
  projectId: z.string(),
});
export const ExperimentCreateEventSchema = z.object({
  projectId: z.string(),
  datasetId: z.string(),
  runId: z.string(),
  description: z.string().optional(),
});
export const DataRetentionProcessingEventSchema = z.object({
  projectId: z.string(),
  retention: z.number(),
});

export const CreateEvalQueueEventSchema = DatasetRunItemUpsertEventSchema.and(
  z.object({
    configId: z.string(),
    timestamp: z.date(),
  }),
).or(
  TraceQueueEventSchema.and(
    z.object({
      timestamp: z.date(),
      configId: z.string(),
      exactTimestamp: z.date().optional(),
    }),
  ),
);

export const DeadLetterRetryQueueEventSchema = z.object({
  timestamp: z.date(),
});

export type CreateEvalQueueEventType = z.infer<
  typeof CreateEvalQueueEventSchema
>;
export type BatchExportJobType = z.infer<typeof BatchExportJobSchema>;
export type CloudSpendAlertJobType = z.infer<typeof CloudSpendAlertJobSchema>;
export type TraceQueueEventType = z.infer<typeof TraceQueueEventSchema>;
export type TracesQueueEventType = z.infer<typeof TracesQueueEventSchema>;
export type ScoresQueueEventType = z.infer<typeof ScoresQueueEventSchema>;
export type DatasetQueueEventType = z.infer<typeof DatasetQueueEventSchema>;
export type ProjectQueueEventType = z.infer<typeof ProjectQueueEventSchema>;
export type DatasetRunItemUpsertEventType = z.infer<
  typeof DatasetRunItemUpsertEventSchema
>;
export type EvalExecutionEventType = z.infer<typeof EvalExecutionEvent>;
export type IngestionEventQueueType = z.infer<typeof IngestionEvent>;
export type OtelIngestionEventQueueType = z.infer<typeof OtelIngestionEvent>;
export type ExperimentCreateEventType = z.infer<
  typeof ExperimentCreateEventSchema
>;
export type PostHogIntegrationProcessingEventType = z.infer<
  typeof PostHogIntegrationProcessingEventSchema
>;
export type MixpanelIntegrationProcessingEventType = z.infer<
  typeof MixpanelIntegrationProcessingEventSchema
>;
export type DataRetentionProcessingEventType = z.infer<
  typeof DataRetentionProcessingEventSchema
>;
export type BlobStorageIntegrationProcessingEventType = z.infer<
  typeof BlobStorageIntegrationProcessingEventSchema
>;
export type DeadLetterRetryQueueEventType = z.infer<
  typeof DeadLetterRetryQueueEventSchema
>;

export const RetryBaggage = z.object({
  originalJobTimestamp: z.date(),
  attempt: z.number(),
});

export type RetryBaggage = z.infer<typeof RetryBaggage>;

export enum QueueName {
  TraceUpsert = "trace-upsert", // Ingestion pipeline adds events on each Trace upsert
  TraceDelete = "trace-delete",
  ProjectDelete = "project-delete",
  EvaluationExecution = "evaluation-execution-queue", // Worker executes Evals
  EvaluationExecutionSecondaryQueue = "secondary-evaluation-execution-queue", // Separates high-throughput eval projects from other projects.
  DatasetRunItemUpsert = "dataset-run-item-upsert-queue",
  BatchExport = "batch-export-queue",
  OtelIngestionQueue = "otel-ingestion-queue",
  OtelIngestionSecondaryQueue = "secondary-otel-ingestion-queue", // Separates high priority + high throughput projects from other projects.
  IngestionQueue = "ingestion-queue", // Process single events with S3-merge
  IngestionSecondaryQueue = "secondary-ingestion-queue", // Separates high priority + high throughput projects from other projects.
  CloudUsageMeteringQueue = "cloud-usage-metering-queue",
  CloudSpendAlertQueue = "cloud-spend-alert-queue",
  CloudFreeTierUsageThresholdQueue = "cloud-free-tier-usage-threshold-queue",
  ExperimentCreate = "experiment-create-queue",
  PostHogIntegrationQueue = "posthog-integration-queue",
  PostHogIntegrationProcessingQueue = "posthog-integration-processing-queue",
  MixpanelIntegrationQueue = "mixpanel-integration-queue",
  MixpanelIntegrationProcessingQueue = "mixpanel-integration-processing-queue",
  BlobStorageIntegrationQueue = "blobstorage-integration-queue",
  BlobStorageIntegrationProcessingQueue = "blobstorage-integration-processing-queue",
  CoreDataS3ExportQueue = "core-data-s3-export-queue",
  MeteringDataPostgresExportQueue = "metering-data-postgres-export-queue",
  DataRetentionQueue = "data-retention-queue",
  DataRetentionProcessingQueue = "data-retention-processing-queue",
  CreateEvalQueue = "create-eval-queue",
  ScoreDelete = "score-delete",
  DatasetDelete = "dataset-delete-queue",
  DeadLetterRetryQueue = "dead-letter-retry-queue",
  EventPropagationQueue = "event-propagation-queue",
}

export enum QueueJobs {
  TraceUpsert = "trace-upsert",
  TraceDelete = "trace-delete",
  ProjectDelete = "project-delete",
  DatasetRunItemUpsert = "dataset-run-item-upsert",
  EvaluationExecution = "evaluation-execution-job",
  BatchExportJob = "batch-export-job",
  CloudUsageMeteringJob = "cloud-usage-metering-job",
  CloudSpendAlertJob = "cloud-spend-alert-job",
  CloudFreeTierUsageThresholdJob = "cloud-free-tier-usage-threshold-job",
  OtelIngestionJob = "otel-ingestion-job",
  IngestionJob = "ingestion-job",
  ExperimentCreateJob = "experiment-create-job",
  PostHogIntegrationJob = "posthog-integration-job",
  PostHogIntegrationProcessingJob = "posthog-integration-processing-job",
  MixpanelIntegrationJob = "mixpanel-integration-job",
  MixpanelIntegrationProcessingJob = "mixpanel-integration-processing-job",
  BlobStorageIntegrationJob = "blobstorage-integration-job",
  BlobStorageIntegrationProcessingJob = "blobstorage-integration-processing-job",
  CoreDataS3ExportJob = "core-data-s3-export-job",
  MeteringDataPostgresExportJob = "metering-data-postgres-export-job",
  DataRetentionJob = "data-retention-job",
  DataRetentionProcessingJob = "data-retention-processing-job",
  CreateEvalJob = "create-eval-job",
  ScoreDelete = "score-delete",
  DatasetDelete = "dataset-delete-job",
  DeadLetterRetryJob = "dead-letter-retry-job",
  EventPropagationJob = "event-propagation-job",
}

export type TQueueJobTypes = {
  [QueueName.TraceUpsert]: {
    timestamp: Date;
    id: string;
    payload: TraceQueueEventType;
    name: QueueJobs.TraceUpsert;
  };
  [QueueName.TraceDelete]: {
    timestamp: Date;
    id: string;
    payload: TracesQueueEventType | TraceQueueEventType;
    name: QueueJobs.TraceDelete;
  };
  [QueueName.ScoreDelete]: {
    timestamp: Date;
    id: string;
    payload: ScoresQueueEventType;
    name: QueueJobs.ScoreDelete;
  };
  [QueueName.DatasetDelete]: {
    timestamp: Date;
    id: string;
    payload: DatasetQueueEventType;
    name: QueueJobs.DatasetDelete;
  };
  [QueueName.ProjectDelete]: {
    timestamp: Date;
    id: string;
    payload: ProjectQueueEventType;
    name: QueueJobs.ProjectDelete;
  };
  [QueueName.DatasetRunItemUpsert]: {
    timestamp: Date;
    id: string;
    payload: DatasetRunItemUpsertEventType;
    name: QueueJobs.DatasetRunItemUpsert;
    retryBaggage?: RetryBaggage;
  };
  [QueueName.EvaluationExecution]: {
    timestamp: Date;
    id: string;
    payload: EvalExecutionEventType;
    name: QueueJobs.EvaluationExecution;
    retryBaggage?: RetryBaggage;
  };
  [QueueName.EvaluationExecutionSecondaryQueue]: {
    timestamp: Date;
    id: string;
    payload: EvalExecutionEventType;
    name: QueueJobs.EvaluationExecution;
    retryBaggage?: RetryBaggage;
  };
  [QueueName.BatchExport]: {
    timestamp: Date;
    id: string;
    payload: BatchExportJobType;
    name: QueueJobs.BatchExportJob;
  };
  [QueueName.OtelIngestionQueue]: {
    timestamp: Date;
    id: string;
    payload: OtelIngestionEventQueueType;
    name: QueueJobs.OtelIngestionJob;
  };
  [QueueName.OtelIngestionSecondaryQueue]: {
    timestamp: Date;
    id: string;
    payload: OtelIngestionEventQueueType;
    name: QueueJobs.OtelIngestionJob;
  };
  [QueueName.IngestionQueue]: {
    timestamp: Date;
    id: string;
    payload: IngestionEventQueueType;
    name: QueueJobs.IngestionJob;
  };
  [QueueName.IngestionSecondaryQueue]: {
    timestamp: Date;
    id: string;
    payload: IngestionEventQueueType;
    name: QueueJobs.IngestionJob;
  };
  [QueueName.ExperimentCreate]: {
    timestamp: Date;
    id: string;
    payload: ExperimentCreateEventType;
    name: QueueJobs.ExperimentCreateJob;
    retryBaggage?: RetryBaggage;
  };
  [QueueName.PostHogIntegrationProcessingQueue]: {
    timestamp: Date;
    id: string;
    payload: PostHogIntegrationProcessingEventType;
    name: QueueJobs.PostHogIntegrationProcessingJob;
  };
  [QueueName.MixpanelIntegrationProcessingQueue]: {
    timestamp: Date;
    id: string;
    payload: MixpanelIntegrationProcessingEventType;
    name: QueueJobs.MixpanelIntegrationProcessingJob;
  };
  [QueueName.DataRetentionProcessingQueue]: {
    timestamp: Date;
    id: string;
    payload: DataRetentionProcessingEventType;
    name: QueueJobs.DataRetentionProcessingJob;
  };
  [QueueName.CreateEvalQueue]: {
    timestamp: Date;
    id: string;
    payload: CreateEvalQueueEventType;
    name: QueueJobs.CreateEvalJob;
  };
  [QueueName.BlobStorageIntegrationProcessingQueue]: {
    timestamp: Date;
    id: string;
    payload: BlobStorageIntegrationProcessingEventType;
    name: QueueJobs.BlobStorageIntegrationProcessingJob;
  };
  [QueueName.DeadLetterRetryQueue]: {
    timestamp: Date;
    id: string;
    payload: DeadLetterRetryQueueEventType;
    name: QueueJobs.DeadLetterRetryJob;
  };
  [QueueName.CloudSpendAlertQueue]: {
    timestamp: Date;
    id: string;
    payload: CloudSpendAlertJobType;
    name: QueueJobs.CloudSpendAlertJob;
  };
  [QueueName.CloudFreeTierUsageThresholdQueue]: {
    timestamp: Date;
    id: string;
    name: QueueJobs.CloudFreeTierUsageThresholdJob;
  };
  [QueueName.EventPropagationQueue]: {
    timestamp: Date;
    id: string;
    name: QueueJobs.EventPropagationJob;
  };
};
