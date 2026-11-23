export interface NetworkCase {
  case_id: string;
  title: string;
  symptom: string;
  topology: string;
  ip_info: string;
  command_output: string;
  expected_behavior: string;
  actual_behavior: string;
  expected_fault: string;
  osi_layer: string;
  concept: string;
  severity: string;
  expected_next_command: string;
  expected_fix: string;
}

export interface EvaluationCheck {
  name: string;
  passed: boolean;
  score: number;
  detail: string;
}

export interface EvaluationDetails {
  verdict: 'PASS' | 'FAIL';
  overall_score: number;
  passed_checks: number;
  total_checks: number;
  checks: EvaluationCheck[];
  summary: string;
}

export type ReviewStatus = 'Pending Review' | 'Accepted' | 'Edited' | 'Rejected';
export type EvaluationStatus = 'PASS' | 'FAIL' | 'UNTESTED';

export interface HistoryRecord {
  id: number;
  case_id: string;
  case_title: string;
  osi_layer_expected: string;
  severity: string;
  is_custom: number;
  timestamp: string;
  evidence_used: string;
  problem: string;
  root_cause: string;
  evidence: string[];
  recommended_fix: string;
  next_command: string;
  osi_layer: string;
  confidence: string;
  evaluation_status: EvaluationStatus;
  evaluation_details: EvaluationDetails | null;
  review_status: ReviewStatus;
  review_reason: string | null;
  reviewed_at: string | null;
  original_problem: string;
  original_root_cause: string;
  original_evidence: string[];
  original_recommended_fix: string;
  original_next_command: string;
  original_osi_layer: string;
  original_confidence: string;
  batch_run_id: string | null;
}

export interface LayerAccuracy {
  layer: string;
  total: number;
  passed: number;
  failed: number;
  untested: number;
  accuracy: number;
}

export interface SeverityAccuracy {
  severity: string;
  total: number;
  passed: number;
  failed: number;
  untested: number;
  accuracy: number;
}

export interface RecentActivityItem {
  id: number;
  case_id: string;
  case_title: string;
  timestamp: string;
  problem: string;
  root_cause: string;
  osi_layer: string;
  severity: string;
  confidence: string;
  evaluation_status: EvaluationStatus;
  review_status: ReviewStatus;
}

export interface DashboardStats {
  total_cases_in_dataset: number;
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  untested_runs: number;
  evaluated_runs: number;
  overall_accuracy: number;
  review_stats: {
    pending: number;
    accepted: number;
    edited: number;
    rejected: number;
  };
  layer_accuracy: LayerAccuracy[];
  severity_accuracy: SeverityAccuracy[];
  recent_activity: RecentActivityItem[];
}

export interface BatchRunRecord {
  id: string;
  timestamp: string;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  untested_cases: number;
  accuracy: number;
  status: string;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  database?: string;
  dataset_loaded?: boolean;
  cases_count?: number;
  ai_configured?: boolean;
  model?: string;
  timestamp?: string;
  error?: string;
}

export type NavSection =
  | 'dashboard'
  | 'cases'
  | 'custom'
  | 'batch'
  | 'history'
  | 'packet-tracer';
