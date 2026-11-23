import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { api } from '../api/client';
import type { BatchRunRecord, HistoryRecord, NetworkCase } from '../types';

interface BatchTestingViewProps {
  cases: NetworkCase[];
  onBatchUpdated: () => void;
  onInspectHistory: (historyId: number) => void;
}

interface BatchCaseResult {
  case_id: string;
  title: string;
  osi_layer: string;
  severity: string;
  status: 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'ERROR';
  history_id?: number;
  score?: number;
  root_cause?: string;
  error?: string;
}

export function BatchTestingView({
  cases,
  onBatchUpdated,
  onInspectHistory,
}: BatchTestingViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [layerFilter, setLayerFilter] = useState('ALL');
  const [running, setRunning] = useState(false);
  const stopRequestedRef = useRef(false);

  const [results, setResults] = useState<BatchCaseResult[]>([]);
  const [previousBatches, setPreviousBatches] = useState<BatchRunRecord[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    if (cases.length > 0 && selectedIds.length === 0) {
      // Default to first 5 cases so quick test runs fast, while allowing Select All 30
      setSelectedIds(cases.slice(0, 5).map((c) => c.case_id));
    }
  }, [cases]);

  const loadBatches = async () => {
    try {
      const res = await api.getBatches();
      setPreviousBatches(res.batches);
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const visibleCases = useMemo(() => {
    if (layerFilter === 'ALL') return cases;
    return cases.filter((c) => c.osi_layer.toLowerCase().includes(layerFilter.toLowerCase()));
  }, [cases, layerFilter]);

  const toggleCase = (id: string) => {
    if (running) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllVisible = () => {
    if (running) return;
    const ids = visibleCases.map((c) => c.case_id);
    setSelectedIds(ids);
  };

  const clearSelection = () => {
    if (running) return;
    setSelectedIds([]);
  };

  const handleRunBatch = async () => {
    if (selectedIds.length === 0) return;
    setBatchError(null);
    stopRequestedRef.current = false;
    setRunning(true);

    const batchId = `BATCH-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;
    const targetCases = cases.filter((c) => selectedIds.includes(c.case_id));

    const initialResults: BatchCaseResult[] = targetCases.map((c) => ({
      case_id: c.case_id,
      title: c.title,
      osi_layer: c.osi_layer,
      severity: c.severity,
      status: 'PENDING',
    }));
    setResults(initialResults);

    let passed = 0;
    let failed = 0;
    let untested = targetCases.length;

    for (let i = 0; i < targetCases.length; i++) {
      if (stopRequestedRef.current) {
        break;
      }

      const c = targetCases[i];
      setResults((prev) =>
        prev.map((r) => (r.case_id === c.case_id ? { ...r, status: 'RUNNING' } : r))
      );

      try {
        const res = await api.diagnose({
          case_id: c.case_id,
          auto_evaluate: true,
          batch_run_id: batchId,
        });
        const rec: HistoryRecord = res.record;
        const evalVerdict = rec.evaluation_status === 'PASS' ? 'PASS' : 'FAIL';
        if (evalVerdict === 'PASS') passed++;
        else failed++;
        untested--;

        setResults((prev) =>
          prev.map((r) =>
            r.case_id === c.case_id
              ? {
                  ...r,
                  status: evalVerdict,
                  history_id: rec.id,
                  score: rec.evaluation_details?.overall_score,
                  root_cause: rec.root_cause,
                }
              : r
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Batch item error';
        setResults((prev) =>
          prev.map((r) => (r.case_id === c.case_id ? { ...r, status: 'ERROR', error: msg } : r))
        );
        if (msg.includes('GEMINI_API_KEY')) {
          setBatchError(msg);
          break;
        }
      }
    }

    const evaluated = passed + failed;
    const accuracy = evaluated > 0 ? Math.round((passed / evaluated) * 1000) / 10 : 0;

    try {
      await api.saveBatch({
        id: batchId,
        timestamp: new Date().toISOString(),
        total_cases: targetCases.length,
        passed_cases: passed,
        failed_cases: failed,
        untested_cases: untested,
        accuracy,
        status: stopRequestedRef.current ? 'Stopped' : 'Completed',
      });
      await loadBatches();
    } catch {
      // Ignore save error if aborted
    }

    setRunning(false);
    onBatchUpdated();
  };

  const summary = useMemo(() => {
    const total = results.length;
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const untested = results.filter((r) => r.status === 'PENDING' || r.status === 'RUNNING' || r.status === 'ERROR').length;
    const evaluated = passed + failed;
    const accuracy = evaluated > 0 ? Math.round((passed / evaluated) * 1000) / 10 : 0;
    const completed = results.filter((r) => r.status !== 'PENDING' && r.status !== 'RUNNING').length;
    return { total, passed, failed, untested, evaluated, accuracy, completed };
  }, [results]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Batch Testing &amp; Evaluation</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Execute real Gemini Flash diagnoses and automated evaluation checks across multiple dataset cases.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {!running ? (
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleRunBatch}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" />
              Run Batch Test ({selectedIds.length} Cases)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                stopRequestedRef.current = true;
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Square className="h-3.5 w-3.5" />
              Stop Batch
            </button>
          )}
        </div>
      </div>

      {batchError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/35 p-4 text-xs text-rose-200 flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{batchError}</span>
        </div>
      )}

      {/* Case Selection Panel */}
      <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-100">Select Cases to Test</h3>
            <select
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value)}
              disabled={running}
              className="rounded-lg border border-[#22365E] bg-[#070E1C] px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
            >
              <option value="ALL">All OSI Layers</option>
              <option value="Layer 1">Layer 1</option>
              <option value="Layer 2">Layer 2</option>
              <option value="Layer 3">Layer 3</option>
              <option value="Layer 4">Layer 4</option>
              <option value="Layer 5">Layer 5</option>
              <option value="Layer 6">Layer 6</option>
              <option value="Layer 7">Layer 7</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={running}
              className="text-cyan-400 hover:text-cyan-300 disabled:opacity-50 cursor-pointer"
            >
              Select All Visible ({visibleCases.length})
            </button>
            <span className="text-slate-600" aria-hidden="true">|</span>
            <button
              type="button"
              onClick={clearSelection}
              disabled={running}
              className="text-slate-400 hover:text-slate-200 disabled:opacity-50 cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto pr-1">
          {visibleCases.map((c) => {
            const checked = selectedIds.includes(c.case_id);
            return (
              <label
                key={c.case_id}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs transition-colors cursor-pointer ${
                  checked
                    ? 'border-cyan-500/50 bg-[#102140] text-slate-100'
                    : 'border-[#1B2B4B] bg-[#081020] text-slate-300 hover:bg-[#0D1930]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={running}
                  onChange={() => toggleCase(c.case_id)}
                  className="mt-0.5 accent-cyan-500"
                />
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-cyan-400">
                    {c.case_id} · <span className="text-slate-400">{c.osi_layer}</span>
                  </div>
                  <div className="font-medium truncate">{c.title}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Live Batch Summary & Progress */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-100">
                Current Batch Execution Summary
              </h3>
              <span className="font-mono text-xs text-slate-300 tabular-nums">
                Progress: {summary.completed} / {summary.total} completed
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-[#13213D] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                style={{
                  width: `${summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0}%`,
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-3">
                <div className="text-[11px] text-slate-400">Total Tested</div>
                <div className="mt-1 font-mono text-lg font-semibold text-slate-100 tabular-nums">
                  {summary.evaluated} / {summary.total}
                </div>
              </div>
              <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-3">
                <div className="text-[11px] text-slate-400">Passed</div>
                <div className="mt-1 font-mono text-lg font-semibold text-emerald-300 tabular-nums">
                  {summary.passed}
                </div>
              </div>
              <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-3">
                <div className="text-[11px] text-slate-400">Failed</div>
                <div className="mt-1 font-mono text-lg font-semibold text-rose-300 tabular-nums">
                  {summary.failed}
                </div>
              </div>
              <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-3">
                <div className="text-[11px] text-slate-400">Untested / Error</div>
                <div className="mt-1 font-mono text-lg font-semibold text-amber-300 tabular-nums">
                  {summary.untested}
                </div>
              </div>
              <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-3">
                <div className="text-[11px] text-slate-400">Overall Accuracy</div>
                <div className="mt-1 font-mono text-lg font-semibold text-cyan-300 tabular-nums">
                  {summary.accuracy.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1A2B4C] bg-[#081020] text-[11px] font-medium text-slate-400">
                    <th className="py-2.5 px-4">Case ID</th>
                    <th className="py-2.5 px-4">Title</th>
                    <th className="py-2.5 px-4">OSI Layer</th>
                    <th className="py-2.5 px-4">Result</th>
                    <th className="py-2.5 px-4">Diagnosed Root Cause / Note</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#162440] text-xs">
                  {results.map((r) => (
                    <tr key={r.case_id} className="hover:bg-[#101D38] transition-colors">
                      <td className="py-3 px-4 font-mono text-cyan-400 whitespace-nowrap">
                        {r.case_id}
                      </td>
                      <td className="py-3 px-4 text-slate-200 max-w-xs truncate">{r.title}</td>
                      <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{r.osi_layer}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {r.status === 'PASS' && (
                          <span className="inline-flex items-center gap-1 text-emerald-300 font-medium tabular-nums">
                            <CheckCircle2 className="h-3.5 w-3.5" /> PASS ({r.score}%)
                          </span>
                        )}
                        {r.status === 'FAIL' && (
                          <span className="inline-flex items-center gap-1 text-rose-300 font-medium tabular-nums">
                            <XCircle className="h-3.5 w-3.5" /> FAIL ({r.score}%)
                          </span>
                        )}
                        {r.status === 'RUNNING' && (
                          <span className="inline-flex items-center gap-1 text-cyan-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running...
                          </span>
                        )}
                        {r.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Clock className="h-3.5 w-3.5" /> Queued
                          </span>
                        )}
                        {r.status === 'ERROR' && (
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5" /> Error
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-md truncate">
                        {r.error ? <span className="text-rose-300">{r.error}</span> : r.root_cause || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {r.history_id ? (
                          <button
                            type="button"
                            onClick={() => onInspectHistory(r.history_id!)}
                            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" /> Inspect
                          </button>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Historical Batch Runs Table */}
      {previousBatches.length > 0 && (
        <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#1A2B4C]">
            <h3 className="text-sm font-semibold text-slate-100">Saved Batch Test Runs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1A2B4C] bg-[#081020] text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 px-4">Batch ID</th>
                  <th className="py-2.5 px-4">Total Cases</th>
                  <th className="py-2.5 px-4">Passed</th>
                  <th className="py-2.5 px-4">Failed</th>
                  <th className="py-2.5 px-4">Accuracy</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162440] text-xs">
                {previousBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-[#101D38]">
                    <td className="py-2.5 px-4 font-mono text-cyan-400">{b.id}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums">{b.total_cases}</td>
                    <td className="py-2.5 px-4 font-mono text-emerald-300 tabular-nums">{b.passed_cases}</td>
                    <td className="py-2.5 px-4 font-mono text-rose-300 tabular-nums">{b.failed_cases}</td>
                    <td className="py-2.5 px-4 font-mono text-cyan-300 tabular-nums">{b.accuracy.toFixed(1)}%</td>
                    <td className="py-2.5 px-4 text-slate-300">{b.status}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-400 tabular-nums">
                      {new Date(b.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
