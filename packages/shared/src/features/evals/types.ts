import { z } from "zod";

export const EvalTargetObject = {
  TRACE: "trace",
  DATASET: "dataset",
  EVENT: "event",
  EXPERIMENT: "experiment",
} as const;
export type EvalTargetObject =
  (typeof EvalTargetObject)[keyof typeof EvalTargetObject];
export const EvalTargetObjectSchema = z.enum(Object.values(EvalTargetObject));
