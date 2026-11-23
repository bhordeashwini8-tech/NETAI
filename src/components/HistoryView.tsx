import { useMemo, useState } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  Terminal,
  AlertTriangle,
} from 'lucide-react';
import type { HistoryRecord } from '../types';
import { DiagnosisResultPanel } from './DiagnosisResultPanel';

interface HistoryViewProps {
  history: HistoryRecord[];
  loading: boolean;
  error: string | null;
  selectedRecordId: number | null;
  onSelectRecord: (id: number | null) => void;
  onRefresh: () => void;
  onEvaluate: (historyId: number) => Promise<HistoryRecord | null>;
  onReview: (
    historyId: number,
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
  ) => Promise<HistoryRecord>;
}

export function HistoryView({
  history,
  loading,
  error,
  selectedRecordId,
  onSelectRecord,
  onRefresh,
  onEvaluate,
  onReview,
}: HistoryViewProps) {
  const [search, setSearch] = useState('');
  const [evalFilter, setEvalFilter] = useState('ALL');
  const [reviewFilter, setReviewFilter] = useState('ALL');
  const [evaluating, setEvaluating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((r) => {
      if (evalFilter !== 'ALL' && r.evaluation_status !== evalFilter) return false;
      if (reviewFilter !== 'ALL' && r.review_status !== reviewFilter) return false;
      if (q) {
        return (
          String(r.id).includes(q) ||
          r.case_id.toLowerCase().includes(q) ||
          r.problem.toLowerCase().includes(q) ||
          r.root_cause.toLowerCase().includes(q) ||
          r.recommended_fix.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [history, search, evalFilter, reviewFilter]);

  const selectedRecord = useMemo(
    () => history.find((r) => r.id === selectedRecordId) || null,
    [history, selectedRecordId]
  );

  const parseEvidenceSnapshot = (raw: string) => {
    try {
      return JSON.parse(raw) as {
        topology?: string;
        ip_info?: string;
        command_output?: string;
        additional_evidence?: string;
        symptom?: string;
      };
    } catch {
      return { command_output: raw };
    }
  };

  if (selectedRecord) {
    const snapshot = parseEvidenceSnapshot(selectedRecord.evidence_used);
    const isPredefined = selectedRecord.is_custom === 0 && !selectedRecord.case_id.startsWith('CUSTOM-');

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              onSelectRecord(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[#22365E] bg-[#0D182E] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-[#142342] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to History Table
          </button>

          <div className="font-mono text-xs text-slate-400 tabular-nums">
            Record #{selectedRecord.id} · {selectedRecord.case_id} · {new Date(selectedRecord.timestamp).toLocaleString()}
          </div>
        </div>

        {actionError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/35 p-4 text-xs text-rose-200 flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        <DiagnosisResultPanel
          record={selectedRecord}
          isPredefinedCase={isPredefined}
          evaluating={evaluating}
          reviewing={reviewing}
          onEvaluate={async (id) => {
            setEvaluating(true);
            setActionError(null);
            try {
              await onEvaluate(id);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : 'Evaluation failed.');
            } finally {
              setEvaluating(false);
            }
          }}
          onReview={async (id, payload) => {
            setReviewing(true);
            setActionError(null);
            try {
              await onReview(id, payload);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : 'Review failed.');
            } finally {
              setReviewing(false);
            }
          }}
        />

        {/* Evidence Used Snapshot */}
        <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Terminal className="h-4 w-4 text-cyan-400" />
            Evidence Snapshot Submitted at Diagnosis Time
          </div>
          {snapshot.symptom && (
            <p className="text-xs text-slate-300">
              <span className="text-slate-400 font-medium">Symptom: </span>
              {snapshot.symptom}
            </p>
          )}
          {snapshot.ip_info && (
            <p className="font-mono text-xs text-cyan-200">
              <span className="text-slate-400 font-sans font-medium">IP Info: </span>
              {snapshot.ip_info}
            </p>
          )}
          {snapshot.command_output && (
            <pre className="rounded-lg border border-[#1B2B4B] bg-[#050A14] p-4 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap">
              {snapshot.command_output}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Troubleshooting History &amp; Audit Log</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            All persisted AI diagnoses, evaluation verdicts, and human expert review records stored in SQLite.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#22365E] bg-[#0D182E] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-[#142342] disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          Refresh History
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Case ID, problem, root cause, or fix..."
            className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <select
          value={evalFilter}
          onChange={(e) => setEvalFilter(e.target.value)}
          className="rounded-lg border border-[#22365E] bg-[#070E1C] px-3 py-2 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
        >
          <option value="ALL">All Evaluations</option>
          <option value="PASS">PASS</option>
          <option value="FAIL">FAIL</option>
          <option value="UNTESTED">Untested</option>
        </select>

        <select
          value={reviewFilter}
          onChange={(e) => setReviewFilter(e.target.value)}
          className="rounded-lg border border-[#22365E] bg-[#070E1C] px-3 py-2 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
        >
          <option value="ALL">All Review Statuses</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Accepted">Accepted</option>
          <option value="Edited">Edited</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/35 p-4 text-xs text-rose-200 flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* History Table */}
      <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] overflow-hidden">
        {loading && history.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-11 rounded-lg bg-[#101C35] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-200">No diagnosis history records found</p>
            <p className="text-xs text-slate-400">
              {history.length === 0
                ? 'Run a diagnosis from Cases, Custom Diagnosis, or Batch Testing to record entries in SQLite.'
                : 'Try adjusting your search or status filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1A2B4C] bg-[#081020] text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 px-4">ID</th>
                  <th className="py-2.5 px-4">Case ID</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Problem</th>
                  <th className="py-2.5 px-4">Root Cause</th>
                  <th className="py-2.5 px-4">Recommended Fix</th>
                  <th className="py-2.5 px-4">Evaluation</th>
                  <th className="py-2.5 px-4">Human Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162440] text-xs">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onSelectRecord(r.id)}
                    className="hover:bg-[#101D38] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-cyan-400 tabular-nums whitespace-nowrap">
                      #{r.id}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200 whitespace-nowrap">
                      {r.case_id}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-200 max-w-[200px] truncate">{r.problem}</td>
                    <td className="py-3 px-4 text-slate-300 max-w-[220px] truncate">{r.root_cause}</td>
                    <td className="py-3 px-4 text-slate-400 max-w-[220px] truncate">{r.recommended_fix}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.evaluation_status === 'PASS' && (
                        <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> PASS
                        </span>
                      )}
                      {r.evaluation_status === 'FAIL' && (
                        <span className="inline-flex items-center gap-1 text-rose-300 font-medium">
                          <XCircle className="h-3.5 w-3.5" /> FAIL
                        </span>
                      )}
                      {r.evaluation_status === 'UNTESTED' && (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Clock className="h-3.5 w-3.5" /> Untested
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={
                          r.review_status === 'Accepted'
                            ? 'text-emerald-300'
                            : r.review_status === 'Edited'
                              ? 'text-cyan-300'
                              : r.review_status === 'Rejected'
                                ? 'text-rose-300'
                                : 'text-amber-300'
                        }
                      >
                        {r.review_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
