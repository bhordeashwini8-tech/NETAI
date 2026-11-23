import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadCases, type NetworkCase } from './csvLoader.ts';

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
  evaluation_status: 'PASS' | 'FAIL' | 'UNTESTED';
  evaluation_details: EvaluationDetails | null;
  review_status: 'Pending Review' | 'Accepted' | 'Edited' | 'Rejected';
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

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
  return path.resolve(process.cwd(), 'data', 'netsage.db');
}

export function initDatabase(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id TEXT NOT NULL,
      case_title TEXT DEFAULT '',
      osi_layer_expected TEXT DEFAULT '',
      severity TEXT DEFAULT 'Medium',
      is_custom INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL,
      evidence_used TEXT NOT NULL,
      problem TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      evidence TEXT NOT NULL,
      recommended_fix TEXT NOT NULL,
      next_command TEXT NOT NULL,
      osi_layer TEXT NOT NULL,
      confidence TEXT NOT NULL,
      evaluation_status TEXT DEFAULT 'UNTESTED',
      evaluation_details TEXT,
      review_status TEXT DEFAULT 'Pending Review',
      review_reason TEXT,
      reviewed_at TEXT,
      original_problem TEXT NOT NULL,
      original_root_cause TEXT NOT NULL,
      original_evidence TEXT NOT NULL,
      original_recommended_fix TEXT NOT NULL,
      original_next_command TEXT NOT NULL,
      original_osi_layer TEXT NOT NULL,
      original_confidence TEXT NOT NULL,
      batch_run_id TEXT
    );

    CREATE TABLE IF NOT EXISTS batch_runs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      total_cases INTEGER NOT NULL,
      passed_cases INTEGER NOT NULL,
      failed_cases INTEGER NOT NULL,
      untested_cases INTEGER NOT NULL,
      accuracy REAL NOT NULL,
      status TEXT NOT NULL
    );
  `);

  dbInstance = db;
  return db;
}

function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (typeof val !== 'string' || !val.trim()) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function mapRowToHistory(row: Record<string, unknown>): HistoryRecord {
  return {
    id: Number(row.id),
    case_id: String(row.case_id || ''),
    case_title: String(row.case_title || ''),
    osi_layer_expected: String(row.osi_layer_expected || ''),
    severity: String(row.severity || 'Medium'),
    is_custom: Number(row.is_custom || 0),
    timestamp: String(row.timestamp || ''),
    evidence_used: String(row.evidence_used || ''),
    problem: String(row.problem || ''),
    root_cause: String(row.root_cause || ''),
    evidence: safeJsonParse<string[]>(row.evidence, []),
    recommended_fix: String(row.recommended_fix || ''),
    next_command: String(row.next_command || ''),
    osi_layer: String(row.osi_layer || ''),
    confidence: String(row.confidence || ''),
    evaluation_status: (row.evaluation_status as 'PASS' | 'FAIL' | 'UNTESTED') || 'UNTESTED',
    evaluation_details: safeJsonParse<EvaluationDetails | null>(row.evaluation_details, null),
    review_status: (row.review_status as HistoryRecord['review_status']) || 'Pending Review',
    review_reason: row.review_reason ? String(row.review_reason) : null,
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
    original_problem: String(row.original_problem || ''),
    original_root_cause: String(row.original_root_cause || ''),
    original_evidence: safeJsonParse<string[]>(row.original_evidence, []),
    original_recommended_fix: String(row.original_recommended_fix || ''),
    original_next_command: String(row.original_next_command || ''),
    original_osi_layer: String(row.original_osi_layer || ''),
    original_confidence: String(row.original_confidence || ''),
    batch_run_id: row.batch_run_id ? String(row.batch_run_id) : null,
  };
}

export function insertHistoryRecord(input: {
  case_id: string;
  case_title: string;
  osi_layer_expected: string;
  severity: string;
  is_custom: boolean;
  evidence_used: string;
  problem: string;
  root_cause: string;
  evidence: string[];
  recommended_fix: string;
  next_command: string;
  osi_layer: string;
  confidence: string;
  batch_run_id?: string | null;
}): HistoryRecord {
  const db = initDatabase();
  const timestamp = new Date().toISOString();
  const evidenceJson = JSON.stringify(input.evidence);

  const stmt = db.prepare(`
    INSERT INTO history (
      case_id, case_title, osi_layer_expected, severity, is_custom,
      timestamp, evidence_used,
      problem, root_cause, evidence, recommended_fix, next_command, osi_layer, confidence,
      evaluation_status, evaluation_details, review_status,
      original_problem, original_root_cause, original_evidence, original_recommended_fix, original_next_command, original_osi_layer, original_confidence,
      batch_run_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNTESTED', NULL, 'Pending Review', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.case_id,
    input.case_title,
    input.osi_layer_expected,
    input.severity,
    input.is_custom ? 1 : 0,
    timestamp,
    input.evidence_used,
    input.problem,
    input.root_cause,
    evidenceJson,
    input.recommended_fix,
    input.next_command,
    input.osi_layer,
    input.confidence,
    input.problem,
    input.root_cause,
    evidenceJson,
    input.recommended_fix,
    input.next_command,
    input.osi_layer,
    input.confidence,
    input.batch_run_id ?? null
  );

  const inserted = getHistoryById(Number(result.lastInsertRowid));
  if (!inserted) {
    throw new Error('Failed to retrieve newly created diagnosis record.');
  }
  return inserted;
}

export function getHistoryById(id: number): HistoryRecord | null {
  const db = initDatabase();
  const row = db.prepare('SELECT * FROM history WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapRowToHistory(row) : null;
}

export function listHistory(filters?: {
  case_id?: string;
  evaluation_status?: string;
  review_status?: string;
  search?: string;
  limit?: number;
}): HistoryRecord[] {
  const db = initDatabase();
  const rows = db.prepare('SELECT * FROM history ORDER BY id DESC').all() as Record<string, unknown>[];
  let records = rows.map(mapRowToHistory);

  if (filters?.case_id) {
    const cid = filters.case_id.toLowerCase();
    records = records.filter((r) => r.case_id.toLowerCase() === cid);
  }
  if (filters?.evaluation_status && filters.evaluation_status !== 'ALL') {
    records = records.filter((r) => r.evaluation_status === filters.evaluation_status);
  }
  if (filters?.review_status && filters.review_status !== 'ALL') {
    records = records.filter((r) => r.review_status === filters.review_status);
  }
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    records = records.filter(
      (r) =>
        r.case_id.toLowerCase().includes(q) ||
        r.case_title.toLowerCase().includes(q) ||
        r.problem.toLowerCase().includes(q) ||
        r.root_cause.toLowerCase().includes(q) ||
        r.recommended_fix.toLowerCase().includes(q)
    );
  }
  if (filters?.limit && filters.limit > 0) {
    records = records.slice(0, filters.limit);
  }

  return records;
}

export function updateHistoryEvaluation(
  id: number,
  status: 'PASS' | 'FAIL',
  details: EvaluationDetails
): HistoryRecord {
  const db = initDatabase();
  db.prepare(`
    UPDATE history
    SET evaluation_status = ?, evaluation_details = ?
    WHERE id = ?
  `).run(status, JSON.stringify(details), id);

  const updated = getHistoryById(id);
  if (!updated) throw new Error(`History record #${id} not found.`);
  return updated;
}

export function updateHistoryReview(
  id: number,
  payload: {
    action: 'accept' | 'edit' | 'reject';
    reason?: string;
    problem?: string;
    root_cause?: string;
    evidence?: string[];
    recommended_fix?: string;
    next_command?: string;
    osi_layer?: string;
    confidence?: string;
  }
): HistoryRecord {
  const db = initDatabase();
  const existing = getHistoryById(id);
  if (!existing) {
    throw new Error(`History record #${id} not found.`);
  }

  const reviewedAt = new Date().toISOString();

  if (payload.action === 'accept') {
    db.prepare(`
      UPDATE history
      SET review_status = 'Accepted',
          review_reason = ?,
          reviewed_at = ?
      WHERE id = ?
    `).run(payload.reason?.trim() || 'Expert verified AI diagnosis as accurate.', reviewedAt, id);
  } else if (payload.action === 'reject') {
    if (!payload.reason || !payload.reason.trim()) {
      throw new Error('A rejection reason is required when rejecting a diagnosis.');
    }
    db.prepare(`
      UPDATE history
      SET review_status = 'Rejected',
          review_reason = ?,
          reviewed_at = ?
      WHERE id = ?
    `).run(payload.reason.trim(), reviewedAt, id);
  } else if (payload.action === 'edit') {
    const newProblem = payload.problem?.trim() || existing.problem;
    const newRootCause = payload.root_cause?.trim() || existing.root_cause;
    const newEvidence = Array.isArray(payload.evidence) ? payload.evidence : existing.evidence;
    const newFix = payload.recommended_fix?.trim() || existing.recommended_fix;
    const newCmd = payload.next_command?.trim() || existing.next_command;
    const newOsi = payload.osi_layer?.trim() || existing.osi_layer;
    const newConf = payload.confidence?.trim() || existing.confidence;

    db.prepare(`
      UPDATE history
      SET problem = ?,
          root_cause = ?,
          evidence = ?,
          recommended_fix = ?,
          next_command = ?,
          osi_layer = ?,
          confidence = ?,
          review_status = 'Edited',
          review_reason = ?,
          reviewed_at = ?
      WHERE id = ?
    `).run(
      newProblem,
      newRootCause,
      JSON.stringify(newEvidence),
      newFix,
      newCmd,
      newOsi,
      newConf,
      payload.reason?.trim() || 'Updated by human network expert.',
      reviewedAt,
      id
    );
  }

  const updated = getHistoryById(id);
  if (!updated) throw new Error(`History record #${id} not found after update.`);
  return updated;
}

export function saveBatchRun(batch: BatchRunRecord): BatchRunRecord {
  const db = initDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO batch_runs (
      id, timestamp, total_cases, passed_cases, failed_cases, untested_cases, accuracy, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    batch.id,
    batch.timestamp,
    batch.total_cases,
    batch.passed_cases,
    batch.failed_cases,
    batch.untested_cases,
    batch.accuracy,
    batch.status
  );
  return batch;
}

export function listBatchRuns(): BatchRunRecord[] {
  const db = initDatabase();
  const rows = db.prepare('SELECT * FROM batch_runs ORDER BY timestamp DESC LIMIT 20').all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    timestamp: String(r.timestamp),
    total_cases: Number(r.total_cases),
    passed_cases: Number(r.passed_cases),
    failed_cases: Number(r.failed_cases),
    untested_cases: Number(r.untested_cases),
    accuracy: Number(r.accuracy),
    status: String(r.status),
  }));
}

export function computeDashboardStats() {
  const records = listHistory();
  let cases: NetworkCase[] = [];
  try {
    cases = loadCases();
  } catch {
    cases = [];
  }

  const caseMap = new Map<string, NetworkCase>();
  for (const c of cases) {
    caseMap.set(c.case_id.toUpperCase(), c);
  }

  const total_runs = records.length;
  const passed_runs = records.filter((r) => r.evaluation_status === 'PASS').length;
  const failed_runs = records.filter((r) => r.evaluation_status === 'FAIL').length;
  const untested_runs = records.filter((r) => r.evaluation_status === 'UNTESTED').length;
  const evaluated_runs = passed_runs + failed_runs;
  const overall_accuracy = evaluated_runs > 0 ? Math.round((passed_runs / evaluated_runs) * 1000) / 10 : 0;

  const review_stats = {
    pending: records.filter((r) => r.review_status === 'Pending Review').length,
    accepted: records.filter((r) => r.review_status === 'Accepted').length,
    edited: records.filter((r) => r.review_status === 'Edited').length,
    rejected: records.filter((r) => r.review_status === 'Rejected').length,
  };

  // Layer-wise accuracy across Layer 1..Layer 7
  const standardLayers = ['Layer 1', 'Layer 2', 'Layer 3', 'Layer 4', 'Layer 5', 'Layer 6', 'Layer 7'];
  const layerBuckets = new Map<string, { total: number; passed: number; failed: number; untested: number }>();
  for (const l of standardLayers) {
    layerBuckets.set(l, { total: 0, passed: 0, failed: 0, untested: 0 });
  }

  const severities = ['Critical', 'High', 'Medium', 'Low'];
  const severityBuckets = new Map<string, { total: number; passed: number; failed: number; untested: number }>();
  for (const s of severities) {
    severityBuckets.set(s, { total: 0, passed: 0, failed: 0, untested: 0 });
  }

  for (const r of records) {
    const matchedCase = caseMap.get(r.case_id.toUpperCase());
    const rawLayer = matchedCase?.osi_layer || r.osi_layer_expected || r.osi_layer || 'Layer 3';
    const layerMatch = rawLayer.match(/Layer\s*[1-7]/i);
    const layerKey = layerMatch
      ? `Layer ${layerMatch[0].replace(/[^1-7]/g, '')}`
      : 'Layer 3';

    const lb = layerBuckets.get(layerKey) ?? { total: 0, passed: 0, failed: 0, untested: 0 };
    lb.total += 1;
    if (r.evaluation_status === 'PASS') lb.passed += 1;
    else if (r.evaluation_status === 'FAIL') lb.failed += 1;
    else lb.untested += 1;
    layerBuckets.set(layerKey, lb);

    const rawSev = matchedCase?.severity || r.severity || 'Medium';
    const sevKey = severities.find((s) => s.toLowerCase() === rawSev.toLowerCase()) || 'Medium';
    const sb = severityBuckets.get(sevKey) ?? { total: 0, passed: 0, failed: 0, untested: 0 };
    sb.total += 1;
    if (r.evaluation_status === 'PASS') sb.passed += 1;
    else if (r.evaluation_status === 'FAIL') sb.failed += 1;
    else sb.untested += 1;
    severityBuckets.set(sevKey, sb);
  }

  const layer_accuracy = Array.from(layerBuckets.entries()).map(([layer, b]) => {
    const evalCount = b.passed + b.failed;
    return {
      layer,
      total: b.total,
      passed: b.passed,
      failed: b.failed,
      untested: b.untested,
      accuracy: evalCount > 0 ? Math.round((b.passed / evalCount) * 1000) / 10 : 0,
    };
  });

  const severity_accuracy = Array.from(severityBuckets.entries()).map(([severity, b]) => {
    const evalCount = b.passed + b.failed;
    return {
      severity,
      total: b.total,
      passed: b.passed,
      failed: b.failed,
      untested: b.untested,
      accuracy: evalCount > 0 ? Math.round((b.passed / evalCount) * 1000) / 10 : 0,
    };
  });

  const recent_activity = records.slice(0, 8).map((r) => ({
    id: r.id,
    case_id: r.case_id,
    case_title: r.case_title,
    timestamp: r.timestamp,
    problem: r.problem,
    root_cause: r.root_cause,
    osi_layer: r.osi_layer,
    severity: r.severity,
    confidence: r.confidence,
    evaluation_status: r.evaluation_status,
    review_status: r.review_status,
  }));

  return {
    total_cases_in_dataset: cases.length,
    total_runs,
    passed_runs,
    failed_runs,
    untested_runs,
    evaluated_runs,
    overall_accuracy,
    review_stats,
    layer_accuracy,
    severity_accuracy,
    recent_activity,
  };
}
