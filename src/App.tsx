import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  TerminalSquare,
  PlaySquare,
  History,
  Network,
  Menu,
  X,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { api } from './api/client';
import type {
  DashboardStats,
  HealthStatus,
  HistoryRecord,
  NavSection,
  NetworkCase,
} from './types';
import { DashboardView } from './components/DashboardView';
import { CasesView } from './components/CasesView';
import { CustomDiagnosisView } from './components/CustomDiagnosisView';
import { BatchTestingView } from './components/BatchTestingView';
import { HistoryView } from './components/HistoryView';
import { PacketTracerView } from './components/PacketTracerView';

interface ToastMessage {
  id: number;
  type: 'error' | 'success';
  text: string;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'cases', label: 'Troubleshooting Cases', icon: FolderKanban },
  { id: 'custom', label: 'Custom Diagnosis', icon: TerminalSquare },
  { id: 'batch', label: 'Batch Testing', icon: PlaySquare },
  { id: 'history', label: 'History & Audit', icon: History },
  { id: 'packet-tracer', label: 'Packet Tracer Lab', icon: Network },
];

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'Dashboard',
  cases: 'Troubleshooting Cases (30 Scenarios)',
  custom: 'Custom Network Diagnosis',
  batch: 'Batch Testing & Evaluation',
  history: 'Diagnosis History & Audit Log',
  'packet-tracer': 'Packet Tracer & CLI Reference',
};

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [cases, setCases] = useState<NetworkCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);

  const [prefillCli, setPrefillCli] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((type: 'error' | 'success', text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const h = await api.getHealth();
      setHealth(h);
    } catch (err) {
      setHealth({
        status: 'error',
        error: err instanceof Error ? err.message : 'Backend unreachable',
      });
    }
  }, []);

  const loadCasesData = useCallback(async () => {
    setLoadingCases(true);
    setCasesError(null);
    try {
      const res = await api.getCases();
      setCases(res.cases);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load cases';
      setCasesError(msg);
    } finally {
      setLoadingCases(false);
    }
  }, []);

  const loadStatsData = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const res = await api.getStats();
      setStats(res);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load dashboard stats');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadHistoryData = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await api.getHistory();
      setHistory(res.history);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
    loadCasesData();
    loadStatsData();
    loadHistoryData();
  }, [loadHealth, loadCasesData, loadStatsData, loadHistoryData]);

  const syncAfterMutation = useCallback(async () => {
    await Promise.all([loadStatsData(), loadHistoryData()]);
  }, [loadStatsData, loadHistoryData]);

  const handleDiagnoseCase = async (payload: {
    case_id: string;
    symptom: string;
    topology: string;
    ip_info: string;
    command_output: string;
    expected_behavior: string;
    actual_behavior: string;
  }): Promise<HistoryRecord> => {
    try {
      const res = await api.diagnose(payload);
      await syncAfterMutation();
      pushToast('success', `Diagnosis #${res.record.id} completed for ${res.record.case_id}.`);
      return res.record;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI diagnosis failed.';
      pushToast('error', msg);
      throw err;
    }
  };

  const handleDiagnoseCustom = async (payload: {
    case_id: string;
    is_custom: true;
    title: string;
    symptom: string;
    topology: string;
    ip_info: string;
    command_output: string;
    additional_evidence: string;
    severity: string;
    concept: string;
    osi_layer: string;
  }): Promise<HistoryRecord> => {
    try {
      const res = await api.diagnose(payload);
      await syncAfterMutation();
      pushToast('success', `Custom diagnosis #${res.record.id} (${res.record.case_id}) saved.`);
      return res.record;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Custom diagnosis failed.';
      pushToast('error', msg);
      throw err;
    }
  };

  const handleEvaluate = async (historyId: number): Promise<HistoryRecord | null> => {
    try {
      const res = await api.evaluate({ history_id: historyId });
      await syncAfterMutation();
      pushToast(
        res.evaluation.verdict === 'PASS' ? 'success' : 'error',
        res.evaluation.summary
      );
      return res.record;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Evaluation failed.';
      pushToast('error', msg);
      throw err;
    }
  };

  const handleReview = async (
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
  ): Promise<HistoryRecord> => {
    try {
      const res = await api.review({ history_id: historyId, ...payload });
      await syncAfterMutation();
      pushToast('success', `Record #${historyId} marked as ${res.record.review_status}.`);
      return res.record;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Review update failed.';
      pushToast('error', msg);
      throw err;
    }
  };

  const handleNavigate = (section: NavSection) => {
    setActiveNav(section);
    setMobileMenuOpen(false);
    if (section !== 'history') {
      setSelectedHistoryId(null);
    }
  };

  const handleInspectHistory = (historyId: number) => {
    setSelectedHistoryId(historyId);
    setActiveNav('history');
    setMobileMenuOpen(false);
  };

  const handleSendCliToCustom = (cliOutput: string) => {
    setPrefillCli(cliOutput);
    setActiveNav('custom');
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#060C18] text-slate-100 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/65 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-[#172643] bg-[#081020] flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-[#172643] flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className="flex items-center gap-2.5 text-left cursor-pointer"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-slate-950 font-bold text-sm">
                N
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap">
                NetAI
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden rounded-md p-1.5 text-slate-400 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Primary Nav Links */}
          <nav className="p-3 space-y-1" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#122344] text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-300 hover:bg-[#0D182E] hover:text-white border border-transparent'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Real System Readiness Summary (from /api/health) */}
        <div className="p-4 border-t border-[#172643] space-y-2 text-xs">
          <div className="font-medium text-slate-300">System Diagnostics Status</div>
          {health ? (
            health.status === 'ok' ? (
              <div className="space-y-1 text-[11px] text-slate-400 tabular-nums">
                <div className="flex items-center justify-between">
                  <span>API &amp; SQLite</span>
                  <span className="text-emerald-300 font-medium">Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Dataset</span>
                  <span className="font-mono text-slate-200">{health.cases_count ?? 0} cases</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Gemini Flash</span>
                  <span className={health.ai_configured ? 'text-cyan-300' : 'text-amber-300'}>
                    {health.ai_configured ? 'Ready' : 'Key Required'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-rose-300">
                Backend Error: {health.error}
              </div>
            )
          ) : (
            <div className="text-[11px] text-slate-500">Checking backend health...</div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar */}
        <header className="h-16 px-4 sm:px-6 border-b border-[#172643] bg-[#081020]/90 backdrop-blur-sm flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg border border-[#22365E] p-2 text-slate-300 hover:bg-[#111E38]"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">NetAI</span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="font-semibold text-slate-100 truncate">
                {SECTION_TITLES[activeNav]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('custom')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              New Custom Diagnosis
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {health?.status === 'ok' && health.ai_configured === false && (
            <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-950/25 px-4 py-3 text-xs text-amber-200 flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                <strong>GEMINI_API_KEY</strong> is not set on the server. Configure it in the AI Studio <strong>Settings &gt; Secrets</strong> panel (or <code className="font-mono">.env</code> locally) to execute live AI diagnoses.
              </span>
            </div>
          )}

          {activeNav === 'dashboard' && (
            <DashboardView
              stats={stats}
              loading={loadingStats}
              error={statsError}
              onRefresh={loadStatsData}
              onNavigate={handleNavigate}
              onInspectHistory={handleInspectHistory}
            />
          )}

          {activeNav === 'cases' && (
            <CasesView
              cases={cases}
              loadingCases={loadingCases}
              casesError={casesError}
              onDiagnoseCase={handleDiagnoseCase}
              onEvaluate={handleEvaluate}
              onReview={handleReview}
            />
          )}

          {activeNav === 'custom' && (
            <CustomDiagnosisView
              prefillCommandOutput={prefillCli}
              onConsumePrefill={() => setPrefillCli(null)}
              onDiagnoseCustom={handleDiagnoseCustom}
              onEvaluate={handleEvaluate}
              onReview={handleReview}
            />
          )}

          {activeNav === 'batch' && (
            <BatchTestingView
              cases={cases}
              onBatchUpdated={syncAfterMutation}
              onInspectHistory={handleInspectHistory}
            />
          )}

          {activeNav === 'history' && (
            <HistoryView
              history={history}
              loading={loadingHistory}
              error={historyError}
              selectedRecordId={selectedHistoryId}
              onSelectRecord={setSelectedHistoryId}
              onRefresh={loadHistoryData}
              onEvaluate={handleEvaluate}
              onReview={handleReview}
            />
          )}

          {activeNav === 'packet-tracer' && (
            <PacketTracerView
              onSendToCustomDiagnosis={handleSendCliToCustom}
              onOpenCase01={() => handleNavigate('cases')}
            />
          )}
        </main>
      </div>

      {/* Toast Notification Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4 sm:px-0">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border px-4 py-3 text-xs shadow-lg flex items-start gap-2.5 ${
                t.type === 'error'
                  ? 'border-rose-500/50 bg-[#1B0C14] text-rose-100'
                  : 'border-emerald-500/50 bg-[#0A1E1B] text-emerald-100'
              }`}
            >
              {t.type === 'error' ? (
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-relaxed">{t.text}</span>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-slate-400 hover:text-white cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
