import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Layers,
  Clock,
  Loader2,
} from 'lucide-react';
import type { HistoryRecord } from '../types';

interface DiagnosisResultPanelProps {
  record: HistoryRecord;
  isPredefinedCase: boolean;
  onEvaluate: (historyId: number) => Promise<void>;
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
  ) => Promise<void>;
  evaluating?: boolean;
  reviewing?: boolean;
}

export function DiagnosisResultPanel({
  record,
  isPredefinedCase,
  onEvaluate,
  onReview,
  evaluating = false,
  reviewing = false,
}: DiagnosisResultPanelProps) {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showOriginalDiff, setShowOriginalDiff] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editProblem, setEditProblem] = useState(record.problem);
  const [editRootCause, setEditRootCause] = useState(record.root_cause);
  const [editEvidenceText, setEditEvidenceText] = useState(record.evidence.join('\n'));
  const [editFix, setEditFix] = useState(record.recommended_fix);
  const [editNextCmd, setEditNextCmd] = useState(record.next_command);
  const [editOsiLayer, setEditOsiLayer] = useState(record.osi_layer);
  const [editConfidence, setEditConfidence] = useState(record.confidence);
  const [editNote, setEditNote] = useState('');

  // Reject mode state
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    setEditProblem(record.problem);
    setEditRootCause(record.root_cause);
    setEditEvidenceText(record.evidence.join('\n'));
    setEditFix(record.recommended_fix);
    setEditNextCmd(record.next_command);
    setEditOsiLayer(record.osi_layer);
    setEditConfidence(record.confidence);
    setIsEditing(false);
    setIsRejecting(false);
    setRejectReason('');
    setEditNote('');
    setReviewError(null);
  }, [record.id, record.problem, record.root_cause, record.review_status]);

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(record.next_command);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleSaveEdit = async () => {
    setReviewError(null);
    if (!editProblem.trim() || !editRootCause.trim() || !editFix.trim()) {
      setReviewError('Problem, Root Cause, and Recommended Fix cannot be empty.');
      return;
    }
    const evidenceLines = editEvidenceText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    await onReview(record.id, {
      action: 'edit',
      problem: editProblem.trim(),
      root_cause: editRootCause.trim(),
      evidence: evidenceLines,
      recommended_fix: editFix.trim(),
      next_command: editNextCmd.trim(),
      osi_layer: editOsiLayer.trim(),
      confidence: editConfidence.trim(),
      reason: editNote.trim() || undefined,
    });
    setIsEditing(false);
  };

  const handleSubmitReject = async () => {
    setReviewError(null);
    if (!rejectReason.trim()) {
      setReviewError('A rejection reason is required before rejecting a diagnosis.');
      return;
    }
    await onReview(record.id, {
      action: 'reject',
      reason: rejectReason.trim(),
    });
    setIsRejecting(false);
  };

  const evalStatus = record.evaluation_status;
  const reviewStatus = record.review_status;

  return (
    <div className="space-y-5">
      {/* Header Summary Strip */}
      <div className="rounded-xl border border-[#1E3156] bg-[#0B1426] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
              <span className="font-mono font-semibold text-cyan-400">Diagnosis #{record.id}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-300">{record.case_id}</span>
              <span aria-hidden="true">·</span>
              <span>{record.osi_layer}</span>
              <span aria-hidden="true">·</span>
              <span>Confidence {record.confidence}</span>
              <span aria-hidden="true">·</span>
              <span>{new Date(record.timestamp).toLocaleString()}</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-100">{record.problem}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium shrink-0">
            <div className="flex items-center gap-1.5">
              {evalStatus === 'PASS' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-300">Evaluation: PASS</span>
                </>
              )}
              {evalStatus === 'FAIL' && (
                <>
                  <XCircle className="h-4 w-4 text-rose-400" />
                  <span className="text-rose-300">Evaluation: FAIL</span>
                </>
              )}
              {evalStatus === 'UNTESTED' && (
                <>
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">Evaluation: Untested</span>
                </>
              )}
            </div>

            <span className="text-slate-600" aria-hidden="true">|</span>

            <div className="flex items-center gap-1.5">
              {reviewStatus === 'Accepted' && <ThumbsUp className="h-4 w-4 text-emerald-400" />}
              {reviewStatus === 'Edited' && <Edit3 className="h-4 w-4 text-cyan-400" />}
              {reviewStatus === 'Rejected' && <ThumbsDown className="h-4 w-4 text-rose-400" />}
              {reviewStatus === 'Pending Review' && <Clock className="h-4 w-4 text-amber-400" />}
              <span
                className={
                  reviewStatus === 'Accepted'
                    ? 'text-emerald-300'
                    : reviewStatus === 'Edited'
                      ? 'text-cyan-300'
                      : reviewStatus === 'Rejected'
                        ? 'text-rose-300'
                        : 'text-amber-300'
                }
              >
                {reviewStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Core Diagnosis Cards Grid (Single-level depth) */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-cyan-300">Root Cause Analysis</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                {record.osi_layer}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-100">{record.root_cause}</p>
          </div>

          <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-300">Recommended Fix</span>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                Confidence: {record.confidence}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-100">{record.recommended_fix}</p>
          </div>
        </div>

        {/* Supporting Evidence + Next Command */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border border-[#1B2B4B] bg-[#081020] p-4">
            <div className="text-xs font-medium text-slate-300 mb-2">Supporting CLI &amp; Topology Evidence</div>
            {record.evidence.length > 0 ? (
              <ul className="space-y-1.5">
                {record.evidence.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 font-mono text-xs leading-relaxed text-slate-300"
                  >
                    <span className="text-cyan-500/80 select-none tabular-nums">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <span className="break-words">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">No explicit evidence items recorded.</p>
            )}
          </div>

          <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-cyan-300">
                  <Terminal className="h-3.5 w-3.5" />
                  Next Verification Command
                </span>
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-300 hover:bg-[#14223E] hover:text-white transition-colors"
                  title="Copy command"
                >
                  {copiedCmd ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="rounded-md border border-[#1A2948] bg-[#050A14] p-3 font-mono text-xs text-cyan-200 overflow-x-auto whitespace-pre-wrap">
                {record.next_command || 'N/A'}
              </pre>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Run in Cisco IOS privileged EXEC or Packet Tracer CLI to verify interface/protocol state.
            </p>
          </div>
        </div>
      </div>

      {/* Evaluation Engine Module */}
      <div className="rounded-xl border border-[#1E3156] bg-[#0B1426] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              Diagnosis Evaluation Engine
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Compares root cause, remediation commands, networking terminology, configuration grounding, and OSI layer against expected solution.
            </p>
          </div>

          {isPredefinedCase ? (
            <button
              type="button"
              disabled={evaluating}
              onClick={() => onEvaluate(record.id)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {evaluating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {record.evaluation_details ? 'Re-run Evaluation' : 'Evaluate Diagnosis'}
                </>
              )}
            </button>
          ) : (
            <span className="text-xs text-slate-400">
              Custom case — evaluate via Human Expert Review below
            </span>
          )}
        </div>

        {record.evaluation_details && (
          <div className="mt-4 pt-4 border-t border-[#1A2B4C] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {record.evaluation_details.verdict === 'PASS' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300">
                      PASS – Diagnosis meets the evaluation rules
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-rose-400" />
                    <span className="text-rose-300">
                      FAIL – Diagnosis does not meet the evaluation rules
                    </span>
                  </>
                )}
              </div>
              <div className="font-mono text-xs text-slate-300 tabular-nums">
                Score: {record.evaluation_details.overall_score}% · Checks:{' '}
                {record.evaluation_details.passed_checks}/{record.evaluation_details.total_checks} passed
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {record.evaluation_details.checks.map((chk) => (
                <div
                  key={chk.name}
                  className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-3 flex items-start gap-2.5"
                >
                  {chk.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200">{chk.name}</span>
                      <span className="font-mono text-xs text-slate-400 tabular-nums">
                        {chk.score}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{chk.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Human Expert Review Module */}
      <div className="rounded-xl border border-[#1E3156] bg-[#0B1426] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-100">Human Expert Review</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Accept, edit, or reject this diagnosis. Original AI output is preserved for auditability.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={reviewing}
              onClick={() => {
                setIsEditing(false);
                setIsRejecting(false);
                onReview(record.id, { action: 'accept' });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Accept Diagnosis
            </button>

            <button
              type="button"
              disabled={reviewing}
              onClick={() => {
                setIsRejecting(false);
                setIsEditing((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {isEditing ? 'Cancel Edit' : 'Edit Diagnosis'}
            </button>

            <button
              type="button"
              disabled={reviewing}
              onClick={() => {
                setIsEditing(false);
                setIsRejecting((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              {isRejecting ? 'Cancel Reject' : 'Reject'}
            </button>
          </div>
        </div>

        {reviewError && (
          <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{reviewError}</span>
          </div>
        )}

        {record.review_reason && !isEditing && !isRejecting && (
          <div className="mt-3 rounded-lg border border-[#1B2B4B] bg-[#081020] px-4 py-3 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-200">Reviewer Note ({record.review_status}): </span>
              <span>{record.review_reason}</span>
            </div>
            {record.reviewed_at && (
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                {new Date(record.reviewed_at).toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Compare Original AI vs Reviewer-Corrected Result when Edited */}
        {record.review_status === 'Edited' && !isEditing && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowOriginalDiff((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {showOriginalDiff ? 'Hide Original AI Output' : 'Compare Original AI Output vs Reviewer-Corrected'}
            </button>

            {showOriginalDiff && (
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 rounded-lg border border-[#1B2B4B] bg-[#081020] p-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400">Original AI Output</div>
                  <div className="text-xs text-slate-300">
                    <span className="text-slate-400">Problem:</span> {record.original_problem}
                  </div>
                  <div className="text-xs text-slate-300">
                    <span className="text-slate-400">Root Cause:</span> {record.original_root_cause}
                  </div>
                  <div className="text-xs text-slate-300">
                    <span className="text-slate-400">Fix:</span> {record.original_recommended_fix}
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Cmd: {record.original_next_command} · {record.original_osi_layer} · {record.original_confidence}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-cyan-300">Reviewer-Corrected Output</div>
                  <div className="text-xs text-slate-100">
                    <span className="text-slate-400">Problem:</span> {record.problem}
                  </div>
                  <div className="text-xs text-slate-100">
                    <span className="text-slate-400">Root Cause:</span> {record.root_cause}
                  </div>
                  <div className="text-xs text-slate-100">
                    <span className="text-slate-400">Fix:</span> {record.recommended_fix}
                  </div>
                  <div className="text-xs font-mono text-cyan-300">
                    Cmd: {record.next_command} · {record.osi_layer} · {record.confidence}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reject Reason Form */}
        {isRejecting && (
          <div className="mt-4 pt-4 border-t border-[#1A2B4C] space-y-3">
            <label className="block text-xs font-medium text-slate-200">
              Rejection Reason (Required)
            </label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why the AI diagnosis is inaccurate (e.g., misidentified VLAN ID or wrong interface)..."
              className="w-full rounded-lg border border-[#243B66] bg-[#070E1C] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-rose-400 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                className="rounded-lg border border-[#243B66] px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-[#13203B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewing}
                onClick={handleSubmitReject}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 cursor-pointer"
              >
                {reviewing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        )}

        {/* Edit Diagnosis Form */}
        {isEditing && (
          <div className="mt-4 pt-4 border-t border-[#1A2B4C] space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Problem Summary</label>
                <input
                  type="text"
                  value={editProblem}
                  onChange={(e) => setEditProblem(e.target.value)}
                  className="w-full rounded-lg border border-[#243B66] bg-[#070E1C] px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">OSI Layer</label>
                  <select
                    value={editOsiLayer}
                    onChange={(e) => setEditOsiLayer(e.target.value)}
                    className="w-full rounded-lg border border-[#243B66] bg-[#070E1C] px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="Layer 1 (Physical)">Layer 1 (Physical)</option>
                    <option value="Layer 2 (Data Link)">Layer 2 (Data Link)</option>
                    <option value="Layer 3 (Network)">Layer 3 (Network)</option>
                    <option value="Layer 4 (Transport)">Layer 4 (Transport)</option>
                    <option value="Layer 5 (Session)">Layer 5 (Session)</option>
                    <option value="Layer 6 (Presentation)">Layer 6 (Presentation)</option>
                    <option value="Layer 7 (Application)">Layer 7 (Application)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Confidence</label>
                  <input
                    type="text"
                    value={editConfidence}
                    onChange={(e) => setEditConfidence(e.target.value)}
                    placeholder="e.g. 98%"
                    className="w-full rounded-lg border border-[#243B66] bg-[#070E1C] px-3 py-2 text-sm text-slate-100 font-mono focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Root Cause</label>
              <textarea
                rows={2}
                value={editRootCause}
                onChange={(e) => setEditRootCause(e.target.value)}
                className="w-full rounded-lg border border-[#243B66] bg-[#070E1C] px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Recommended Fix</label>
              <textarea
                rows={2}
                value={editFix}
                onChange={(e) => setEditFix(e.target.value)}
                className="w-full rounded-lg border border-[#243B66] bg-[#070E1C] px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Supporting Evidence (one line per item)
                </label>
                <textarea
                  rows={3}
                  value={editEvidenceText}
                  onChange={(e) => setEditEvidenceText(e.target.value)}
                  className="w-full rounded-lg border border-[#243B66] bg-[#070E1C] px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Next Verification Command</label>
                  <input
                    type="text"
                    value={editNextCmd}
                    onChange={(e) => setEditNextCmd(e.target.value)}
                    className="w-full rounded-lg border border-[#243B66] bg-[#070E1C] px-3 py-2 font-mono text-xs text-cyan-200 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Reviewer Note (Optional)</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Summary of expert correction..."
                    className="w-full rounded-lg border border-[#243B66] bg-[#070E1C] px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-[#243B66] px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-[#13203B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewing}
                onClick={handleSaveEdit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 cursor-pointer"
              >
                {reviewing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Expert Corrections
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
