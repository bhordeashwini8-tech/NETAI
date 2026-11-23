import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  ArrowRight,
  RefreshCw,
  Layers,
  AlertTriangle,
  ThumbsUp,
  Edit3,
  ThumbsDown,
} from 'lucide-react';
import type { DashboardStats, NavSection } from '../types';

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNavigate: (section: NavSection) => void;
  onInspectHistory: (historyId: number) => void;
}

export function DashboardView({
  stats,
  loading,
  error,
  onRefresh,
  onNavigate,
  onInspectHistory,
}: DashboardViewProps) {
  if (loading && !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-[#1B2B4B] bg-[#0B1426]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-72 rounded-xl border border-[#1B2B4B] bg-[#0B1426]" />
          <div className="h-72 rounded-xl border border-[#1B2B4B] bg-[#0B1426]" />
        </div>
        <div className="h-64 rounded-xl border border-[#1B2B4B] bg-[#0B1426]" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-6 text-sm text-rose-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 shrink-0 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Top Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Network Diagnostics Overview</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Live metrics aggregated from SQLite history ({stats.total_cases_in_dataset} predefined Cisco &amp; Packet Tracer cases available).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-[#22365E] bg-[#0D182E] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-[#132240] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh Stats
          </button>
          <button
            type="button"
            onClick={() => onNavigate('cases')}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            Diagnose a Case
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Primary KPI Strip (5 dynamic metrics from SQLite) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Diagnosis Runs</span>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2.5 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
            {stats.total_runs}
          </div>
          <div className="mt-1 text-xs text-slate-400 tabular-nums">
            {stats.evaluated_runs} evaluated · {stats.untested_runs} untested
          </div>
        </div>

        <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Successful (PASS)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 font-mono text-2xl font-semibold text-emerald-300 tabular-nums">
            {stats.passed_runs}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Passed evaluation rules
          </div>
        </div>

        <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Failed (FAIL)</span>
            <XCircle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2.5 font-mono text-2xl font-semibold text-rose-300 tabular-nums">
            {stats.failed_runs}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Requires expert review
          </div>
        </div>

        <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Untested Runs</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2.5 font-mono text-2xl font-semibold text-amber-300 tabular-nums">
            {stats.untested_runs}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Custom or pending evaluation
          </div>
        </div>

        <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Overall Accuracy</span>
            <Target className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2.5 font-mono text-2xl font-semibold text-cyan-300 tabular-nums">
            {stats.overall_accuracy.toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-slate-400 tabular-nums">
            {stats.evaluated_runs > 0
              ? `${stats.passed_runs} / ${stats.evaluated_runs} evaluated`
              : 'Run evaluation to score'}
          </div>
        </div>
      </div>

      {/* Middle Row: Human Review Stats + Layer-wise Accuracy + Severity-wise Accuracy */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Human Review Statistics */}
        <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Human Expert Review Statistics</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Audit disposition across all saved troubleshooting diagnoses.
            </p>

            <div className="mt-5 space-y-3.5">
              {[
                {
                  label: 'Pending Review',
                  count: stats.review_stats.pending,
                  color: 'bg-amber-400',
                  textColor: 'text-amber-300',
                  icon: <Clock className="h-3.5 w-3.5 text-amber-400" />,
                },
                {
                  label: 'Accepted',
                  count: stats.review_stats.accepted,
                  color: 'bg-emerald-400',
                  textColor: 'text-emerald-300',
                  icon: <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />,
                },
                {
                  label: 'Edited by Expert',
                  count: stats.review_stats.edited,
                  color: 'bg-cyan-400',
                  textColor: 'text-cyan-300',
                  icon: <Edit3 className="h-3.5 w-3.5 text-cyan-400" />,
                },
                {
                  label: 'Rejected',
                  count: stats.review_stats.rejected,
                  color: 'bg-rose-400',
                  textColor: 'text-rose-300',
                  icon: <ThumbsDown className="h-3.5 w-3.5 text-rose-400" />,
                },
              ].map((item) => {
                const pct = stats.total_runs > 0 ? Math.round((item.count / stats.total_runs) * 100) : 0;
                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-200">
                        {item.icon}
                        {item.label}
                      </span>
                      <span className={`font-mono tabular-nums ${item.textColor}`}>
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#14223E] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#1A2B4C] flex items-center justify-between text-xs">
            <span className="text-slate-400">Need to review pending items?</span>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              Open History →
            </button>
          </div>
        </div>

        {/* Layer-wise Accuracy */}
        <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                OSI Layer-Wise Accuracy
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Pass rate segmented across OSI layers</p>
            </div>
          </div>

          <div className="space-y-3">
            {stats.layer_accuracy.map((row) => {
              const evalCount = row.passed + row.failed;
              return (
                <div key={row.layer} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{row.layer}</span>
                    <span className="font-mono text-slate-300 tabular-nums">
                      {evalCount > 0 ? `${row.accuracy.toFixed(0)}%` : '—'}{' '}
                      <span className="text-slate-500">
                        ({row.passed}P / {row.failed}F / {row.untested}U)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#14223E] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                      style={{ width: `${evalCount > 0 ? row.accuracy : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Severity-wise Accuracy */}
        <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Severity-Wise Accuracy</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Evaluation accuracy grouped by incident severity.
            </p>

            <div className="mt-4 divide-y divide-[#182745]">
              {stats.severity_accuracy.map((sev) => {
                const evalCount = sev.passed + sev.failed;
                const sevColor =
                  sev.severity === 'Critical'
                    ? 'text-rose-300'
                    : sev.severity === 'High'
                      ? 'text-amber-300'
                      : sev.severity === 'Medium'
                        ? 'text-cyan-300'
                        : 'text-slate-300';
                return (
                  <div key={sev.severity} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className={`text-xs font-semibold ${sevColor}`}>{sev.severity}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                        {sev.total} runs · {sev.passed} pass · {sev.failed} fail
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                        {evalCount > 0 ? `${sev.accuracy.toFixed(1)}%` : '—'}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {sev.untested} untested
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#1A2B4C] flex items-center justify-between text-xs">
            <span className="text-slate-400">Benchmark all 30 cases</span>
            <button
              type="button"
              onClick={() => onNavigate('batch')}
              className="font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              Launch Batch Test →
            </button>
          </div>
        </div>
      </div>

      {/* Recent Troubleshooting Activity Table */}
      <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1A2B4C] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Recent Troubleshooting Activity</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Latest AI diagnoses stored in SQLite. Click any row to inspect details.
            </p>
          </div>
          {stats.recent_activity.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              View All Records →
            </button>
          )}
        </div>

        {stats.recent_activity.length === 0 ? (
          <div className="px-6 py-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-200">No diagnosis runs recorded yet</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Select one of the 30 predefined Cisco networking cases, submit a custom CLI capture, or run a batch test to populate live SQLite metrics.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('cases')}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
              >
                Browse 30 Network Cases
              </button>
              <button
                type="button"
                onClick={() => onNavigate('custom')}
                className="rounded-lg border border-[#243B66] bg-[#0E1A33] px-4 py-2 text-xs font-medium text-slate-200 hover:bg-[#152547] cursor-pointer"
              >
                Submit Custom Problem
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1A2B4C] bg-[#081020] text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 px-4">ID</th>
                  <th className="py-2.5 px-4">Case</th>
                  <th className="py-2.5 px-4">Diagnosed Problem</th>
                  <th className="py-2.5 px-4">OSI Layer</th>
                  <th className="py-2.5 px-4">Evaluation</th>
                  <th className="py-2.5 px-4">Review Status</th>
                  <th className="py-2.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162440] text-xs">
                {stats.recent_activity.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onInspectHistory(item.id)}
                    className="hover:bg-[#101D38] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-cyan-400 tabular-nums">#{item.id}</td>
                    <td className="py-3 px-4 font-mono text-slate-200 whitespace-nowrap">
                      {item.case_id}
                    </td>
                    <td className="py-3 px-4 text-slate-200 max-w-xs truncate">{item.problem}</td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{item.osi_layer}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.evaluation_status === 'PASS' && (
                        <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> PASS
                        </span>
                      )}
                      {item.evaluation_status === 'FAIL' && (
                        <span className="inline-flex items-center gap-1 text-rose-300 font-medium">
                          <XCircle className="h-3.5 w-3.5" /> FAIL
                        </span>
                      )}
                      {item.evaluation_status === 'UNTESTED' && (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Clock className="h-3.5 w-3.5" /> Untested
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={
                          item.review_status === 'Accepted'
                            ? 'text-emerald-300'
                            : item.review_status === 'Edited'
                              ? 'text-cyan-300'
                              : item.review_status === 'Rejected'
                                ? 'text-rose-300'
                                : 'text-amber-300'
                        }
                      >
                        {item.review_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400 tabular-nums whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleString()}
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
