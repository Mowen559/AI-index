import type { TraceEvidence, TraceStep } from "@/lib/reverse-engineering/types";
import { nowIso } from "@/lib/reverse-engineering/utils";

export function createTraceStep(
  id: string,
  stage: string,
  input: unknown,
  output: unknown,
  evidence: TraceEvidence[] = [],
  warnings: string[] = [],
): TraceStep {
  const timestamp = nowIso();
  return {
    id,
    stage,
    status: warnings.length > 0 ? "warning" : "ok",
    started_at: timestamp,
    completed_at: timestamp,
    input,
    output,
    evidence,
    warnings,
  };
}
