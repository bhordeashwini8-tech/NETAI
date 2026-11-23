import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Sparkles,
  RotateCcw,
  Edit3,
  Loader2,
  AlertTriangle,
  Terminal,
  Network,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import type { HistoryRecord, NetworkCase } from '../types';
import { TopologyDiagram } from './TopologyDiagram';
import { DiagnosisResultPanel } from './DiagnosisResultPanel';

interface CasesViewProps {
  cases: NetworkCase[];
  loadingCases: boolean;
  casesError: string | null;
  onDiagnoseCase: (payload: {
    case_id: string;
    symptom: string;
    topology: string;
    ip_info: string;
    command_output: string;
    expected_behavior: string;
    actual_behavior: string;
  }) => Promise<HistoryRecord>;
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

const OSI_LAYERS = ['ALL', 'Layer 1', 'Layer 2', 'Layer 3', 'Layer 4', 'Layer 5', 'Layer 6', 'Layer 7'];
const SEVERITIES = ['ALL', 'Critical', 'High', 'Medium', 'Low'];

export function CasesView({
  cases,
  loadingCases,
  casesError,
  onDiagnoseCase,
  onEvaluate,
  onReview,
}: CasesViewProps) {
  const [search, setSearch] = useState('');
  const [layerFilter, setLayerFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  // Evidence editor state
  const [isEditingEvidence, setIsEditingEvidence] = useState(false);
  const [editedSymptom, setEditedSymptom] = useState('');
  const [editedTopology, setEditedTopology] = useState('');
  const [editedIpInfo, setEditedIpInfo] = useState('');
  const [editedCommandOutput, setEditedCommandOutput] = useState('');

  // Diagnosis state
  const [diagnosing, setDiagnosing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<HistoryRecord | null>(null);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (layerFilter !== 'ALL' && !c.osi_layer.toLowerCase().includes(layerFilter.toLowerCase())) {
        return false;
      }
      if (severityFilter !== 'ALL' && c.severity.toLowerCase() !== severityFilter.toLowerCase()) {
        return false;
      }
      if (q) {
        return (
          c.case_id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.symptom.toLowerCase().includes(q) ||
          c.concept.toLowerCase().includes(q) ||
          c.ip_info.toLowerCase().includes(q) ||
          c.command_output.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cases, search, layerFilter, severityFilter]);

  useEffect(() => {
    if (!selectedCaseId && filteredCases.length > 0) {
      setSelectedCaseId(filteredCases[0].case_id);
    }
  }, [filteredCases, selectedCaseId]);

  const selectedCase = useMemo(
    () => cases.find((c) => c.case_id === selectedCaseId) || filteredCases[0] || null,
    [cases, filteredCases, selectedCaseId]
  );

  // Sync evidence editor when selected case changes
  useEffect(() => {
    if (selectedCase) {
      setEditedSymptom(selectedCase.symptom);
      setEditedTopology(selectedCase.topology);
      setEditedIpInfo(selectedCase.ip_info);
      setEditedCommandOutput(selectedCase.command_output);
      setIsEditingEvidence(false);
      setDiagError(null);
      setActiveRecord(null);
    }
  }, [selectedCase?.case_id]);

  const evidenceModified =
    selectedCase !== null &&
    (editedSymptom !== selectedCase.symptom ||
      editedTopology !== selectedCase.topology ||
      editedIpInfo !== selectedCase.ip_info ||
      editedCommandOutput !== selectedCase.command_output);

  const handleResetEvidence = () => {
    if (!selectedCase) return;
    setEditedSymptom(selectedCase.symptom);
    setEditedTopology(selectedCase.topology);
    setEditedIpInfo(selectedCase.ip_info);
    setEditedCommandOutput(selectedCase.command_output);
  };

  const handleRunDiagnosis = async () => {
    if (!selectedCase) return;
    setDiagnosing(true);
    setDiagError(null);
    try {
      const record = await onDiagnoseCase({
        case_id: selectedCase.case_id,
        symptom: editedSymptom,
        topology: editedTopology,
        ip_info: editedIpInfo,
        command_output: editedCommandOutput,
        expected_behavior: selectedCase.expected_behavior,
        actual_behavior: selectedCase.actual_behavior,
      });
      setActiveRecord(record);
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'Diagnosis request failed.');
    } finally {
      setDiagnosing(false);
    }
  };

  const handleRunEvaluation = async (historyId: number) => {
    setEvaluating(true);
    setDiagError(null);
    try {
      const updated = await onEvaluate(historyId);
      if (updated) setActiveRecord(updated);
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'Evaluation failed.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleRunReview = async (
    historyId: number,
    payload: Parameters<CasesViewProps['onReview']>[1]
  ) => {
    setReviewing(true);
    setDiagError(null);
    try {
      const updated = await onReview(historyId, payload);
      setActiveRecord(updated);
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'Review submission failed.');
    } finally {
      setReviewing(false);
    }
  };

  if (casesError) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-6 text-sm text-rose-200 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
        <span>{casesError}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
      {/* Left Column: Search, Filters, and 30 Cases List */}
      <div className="xl:col-span-4 rounded-xl border border-[#1B2B4B] bg-[#0B1426] overflow-hidden flex flex-col xl:max-h-[calc(100vh-120px)]">
        <div className="p-4 border-b border-[#1A2B4C] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Network Troubleshooting Cases
            </h2>
            <span className="font-mono text-xs text-cyan-400 tabular-nums">
              {filteredCases.length} / {cases.length}
            </span>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, symptom, protocol, IP..."
              className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="sr-only" htmlFor="osi-filter">OSI Layer</label>
              <select
                id="osi-filter"
                value={layerFilter}
                onChange={(e) => setLayerFilter(e.target.value)}
                className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
              >
                {OSI_LAYERS.map((l) => (
                  <option key={l} value={l}>
                    {l === 'ALL' ? 'All OSI Layers' : l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="sr-only" htmlFor="sev-filter">Severity</label>
              <select
                id="sev-filter"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'All Severities' : s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto divide-y divide-[#15233E] flex-1">
          {loadingCases ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-[#101C35] animate-pulse" />
              ))}
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-xs font-medium text-slate-300">No matching cases found</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setLayerFilter('ALL');
                  setSeverityFilter('ALL');
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredCases.map((c) => {
              const isSelected = selectedCase?.case_id === c.case_id;
              const sevColor =
                c.severity === 'Critical'
                  ? 'text-rose-300'
                  : c.severity === 'High'
                    ? 'text-amber-300'
                    : c.severity === 'Medium'
                      ? 'text-cyan-300'
                      : 'text-slate-400';

              return (
                <button
                  key={c.case_id}
                  type="button"
                  onClick={() => setSelectedCaseId(c.case_id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#122242] text-slate-100'
                      : 'hover:bg-[#0E1930] text-slate-300'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                      <span className="font-mono font-semibold text-cyan-400">{c.case_id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{c.osi_layer}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-medium ${sevColor}`}>{c.severity}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {c.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{c.concept}</div>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 mt-1 transition-transform ${
                      isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Case Details, Topology, Evidence Editor & AI Diagnosis */}
      <div className="xl:col-span-8 space-y-5">
        {selectedCase ? (
          <>
            <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-5 space-y-5">
              {/* Case Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1A2B4C] pb-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono font-semibold text-cyan-400">
                      {selectedCase.case_id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedCase.osi_layer}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedCase.concept}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        selectedCase.severity === 'Critical'
                          ? 'text-rose-300 font-medium'
                          : selectedCase.severity === 'High'
                            ? 'text-amber-300 font-medium'
                            : 'text-cyan-300 font-medium'
                      }
                    >
                      {selectedCase.severity} Severity
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-100">{selectedCase.title}</h2>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsEditingEvidence((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      isEditingEvidence
                        ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                        : 'border-[#243B66] bg-[#0D182E] text-slate-200 hover:bg-[#142342]'
                    }`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    {isEditingEvidence ? 'Close Evidence Editor' : 'Edit Evidence'}
                  </button>

                  {evidenceModified && (
                    <button
                      type="button"
                      onClick={handleResetEvidence}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B66] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-[#142342] cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={diagnosing}
                    onClick={handleRunDiagnosis}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {diagnosing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Analyzing with Gemini...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Diagnose with AI
                      </>
                    )}
                  </button>
                </div>
              </div>

              {evidenceModified && (
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/25 px-3.5 py-2 text-xs text-cyan-200 flex items-center justify-between">
                  <span>Using customized evidence from the Evidence Editor for AI diagnosis.</span>
                  <button
                    type="button"
                    onClick={handleResetEvidence}
                    className="underline hover:text-white cursor-pointer"
                  >
                    Restore original case evidence
                  </button>
                </div>
              )}

              {/* Topology Visualizer */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                  <Network className="h-3.5 w-3.5 text-cyan-400" />
                  Network Topology
                </div>
                <TopologyDiagram topology={editedTopology} />
              </div>

              {/* Symptom + IP Information + Expected vs Actual Behavior */}
              {!isEditingEvidence ? (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-4 space-y-1.5">
                      <div className="text-xs font-medium text-slate-400">Reported Symptom</div>
                      <p className="text-sm text-slate-100 leading-relaxed">{editedSymptom}</p>
                    </div>
                    <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-4 space-y-1.5">
                      <div className="text-xs font-medium text-slate-400">IP Addressing Information</div>
                      <p className="font-mono text-xs text-cyan-200 leading-relaxed break-words">
                        {editedIpInfo}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Expected Behavior
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {selectedCase.expected_behavior}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Actual Observed Behavior
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {selectedCase.actual_behavior}
                      </p>
                    </div>
                  </div>

                  {/* CLI Command Output */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-300">
                        <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                        Cisco IOS / Endpoint Command Output
                      </span>
                      <span className="text-slate-500">
                        Click &ldquo;Edit Evidence&rdquo; to modify CLI output before diagnosis
                      </span>
                    </div>
                    <pre className="rounded-lg border border-[#1B2B4B] bg-[#050A14] p-4 font-mono text-xs leading-relaxed text-slate-200 overflow-x-auto whitespace-pre-wrap">
                      {editedCommandOutput}
                    </pre>
                  </div>
                </>
              ) : (
                /* Evidence Editor Mode */
                <div className="space-y-4 rounded-lg border border-cyan-500/30 bg-[#081020] p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-cyan-300">
                      Evidence Editor — Modify inputs before sending to Gemini
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingEvidence(false)}
                      className="text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      Done Editing
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Symptom Description
                      </label>
                      <textarea
                        rows={3}
                        value={editedSymptom}
                        onChange={(e) => setEditedSymptom(e.target.value)}
                        className="w-full rounded-lg border border-[#243B66] bg-[#050A14] px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Network Topology
                        </label>
                        <input
                          type="text"
                          value={editedTopology}
                          onChange={(e) => setEditedTopology(e.target.value)}
                          className="w-full rounded-lg border border-[#243B66] bg-[#050A14] px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          IP Addressing Information
                        </label>
                        <input
                          type="text"
                          value={editedIpInfo}
                          onChange={(e) => setEditedIpInfo(e.target.value)}
                          className="w-full rounded-lg border border-[#243B66] bg-[#050A14] px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Show Command Output / CLI Evidence
                    </label>
                    <textarea
                      rows={10}
                      value={editedCommandOutput}
                      onChange={(e) => setEditedCommandOutput(e.target.value)}
                      className="w-full rounded-lg border border-[#243B66] bg-[#050A14] px-3 py-2.5 font-mono text-xs leading-relaxed text-cyan-100 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {diagError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/35 p-4 text-sm text-rose-200 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Diagnosis Error</div>
                  <div className="text-xs text-rose-200/90 mt-0.5">{diagError}</div>
                </div>
              </div>
            )}

            {diagnosing && (
              <div className="rounded-xl border border-[#1E3156] bg-[#0B1426] p-8 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-7 w-7 text-cyan-400 animate-spin" />
                <div className="text-sm font-semibold text-slate-100">
                  Analyzing {selectedCase.case_id} Evidence with Gemini Flash
                </div>
                <p className="text-xs text-slate-400 max-w-md">
                  Inspecting CLI outputs, correlating interface states, verifying OSI layer, and generating grounded Cisco remediation commands.
                </p>
              </div>
            )}

            {activeRecord && !diagnosing && (
              <DiagnosisResultPanel
                record={activeRecord}
                isPredefinedCase={true}
                onEvaluate={handleRunEvaluation}
                onReview={handleRunReview}
                evaluating={evaluating}
                reviewing={reviewing}
              />
            )}
          </>
        ) : (
          <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-12 text-center text-sm text-slate-400">
            Select a network troubleshooting case from the directory to inspect evidence and run AI diagnosis.
          </div>
        )}
      </div>
    </div>
  );
}
