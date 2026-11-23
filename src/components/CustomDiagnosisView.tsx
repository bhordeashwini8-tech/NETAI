import { useEffect, useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, Terminal, RotateCcw } from 'lucide-react';
import type { HistoryRecord } from '../types';
import { DiagnosisResultPanel } from './DiagnosisResultPanel';
import { TopologyDiagram } from './TopologyDiagram';

interface CustomDiagnosisViewProps {
  prefillCommandOutput?: string | null;
  onConsumePrefill?: () => void;
  onDiagnoseCustom: (payload: {
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

const CLI_SNIPPETS: { label: string; snippet: string }[] = [
  {
    label: 'show ip interface brief',
    snippet: `R1# show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     192.168.10.1    YES manual up                    up
GigabitEthernet0/1     10.0.12.1       YES manual administratively down down`,
  },
  {
    label: 'show ip ospf neighbor',
    snippet: `R1# show ip ospf neighbor
Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           1   INIT/DROTHER    00:00:34    10.0.12.2       GigabitEthernet0/0`,
  },
  {
    label: 'show interfaces trunk',
    snippet: `SW1# show interfaces trunk
Port        Mode             Encapsulation  Status        Native vlan
Gi0/1       on               802.1q         trunking      99
Port        Vlans allowed on trunk
Gi0/1       1,10,20,99`,
  },
  {
    label: 'show access-lists',
    snippet: `R1# show access-lists
Extended IP access list BLOCK_WEB
    10 permit icmp any any (24 matches)
    20 deny tcp any any eq 443 (112 matches)`,
  },
];

function generateCustomCaseId(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CUSTOM-${datePart}-${randPart}`;
}

export function CustomDiagnosisView({
  prefillCommandOutput,
  onConsumePrefill,
  onDiagnoseCustom,
  onEvaluate,
  onReview,
}: CustomDiagnosisViewProps) {
  const [customId, setCustomId] = useState<string>(() => generateCustomCaseId());
  const [title, setTitle] = useState('');
  const [symptom, setSymptom] = useState('');
  const [topology, setTopology] = useState('');
  const [ipInfo, setIpInfo] = useState('');
  const [commandOutput, setCommandOutput] = useState('');
  const [additionalEvidence, setAdditionalEvidence] = useState('');
  const [severity, setSeverity] = useState('High');
  const [concept, setConcept] = useState('');
  const [osiLayer, setOsiLayer] = useState('Layer 3');

  const [diagnosing, setDiagnosing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultRecord, setResultRecord] = useState<HistoryRecord | null>(null);

  useEffect(() => {
    if (prefillCommandOutput) {
      setCommandOutput(prefillCommandOutput);
      onConsumePrefill?.();
    }
  }, [prefillCommandOutput, onConsumePrefill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!symptom.trim() || !commandOutput.trim()) {
      setError('Please provide both a Symptom / Problem Description and Show Command Output.');
      return;
    }

    setDiagnosing(true);
    try {
      const record = await onDiagnoseCustom({
        case_id: customId,
        is_custom: true,
        title: title.trim() || `Custom Incident (${customId})`,
        symptom: symptom.trim(),
        topology: topology.trim(),
        ip_info: ipInfo.trim(),
        command_output: commandOutput.trim(),
        additional_evidence: additionalEvidence.trim(),
        severity,
        concept: concept.trim(),
        osi_layer: osiLayer,
      });
      setResultRecord(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Custom diagnosis failed.');
    } finally {
      setDiagnosing(false);
    }
  };

  const handleReset = () => {
    setCustomId(generateCustomCaseId());
    setTitle('');
    setSymptom('');
    setTopology('');
    setIpInfo('');
    setCommandOutput('');
    setAdditionalEvidence('');
    setConcept('');
    setResultRecord(null);
    setError(null);
  };

  const handleReview = async (
    historyId: number,
    payload: Parameters<CustomDiagnosisViewProps['onReview']>[1]
  ) => {
    setReviewing(true);
    setError(null);
    try {
      const updated = await onReview(historyId, payload);
      setResultRecord(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review update failed.');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Custom Network Troubleshooting</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Submit live Cisco IOS, Packet Tracer, or workstation CLI captures for grounded Gemini Flash diagnosis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-cyan-400 tabular-nums">ID: {customId}</span>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#22365E] bg-[#0D182E] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#142342] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New Custom ID
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-5 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Incident Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Branch Office VLAN 20 Unable to Reach Core DHCP"
              className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] px-2.5 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Suspected OSI Layer</label>
              <select
                value={osiLayer}
                onChange={(e) => setOsiLayer(e.target.value)}
                className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] px-2.5 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              >
                <option value="Layer 1">Layer 1 (Physical)</option>
                <option value="Layer 2">Layer 2 (Data Link)</option>
                <option value="Layer 3">Layer 3 (Network)</option>
                <option value="Layer 4">Layer 4 (Transport)</option>
                <option value="Layer 5">Layer 5 (Session)</option>
                <option value="Layer 6">Layer 6 (Presentation)</option>
                <option value="Layer 7">Layer 7 (Application)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Symptom / Problem Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              placeholder="Describe what fails, affected hosts/subnets, and what still works..."
              className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Network Topology
              </label>
              <input
                type="text"
                value={topology}
                onChange={(e) => setTopology(e.target.value)}
                placeholder="e.g., PC1 (Fa0) -> SW1 (Gi0/1) -> R1 (Gi0/0) -> Core-R2"
                className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  IP Addressing Info
                </label>
                <input
                  type="text"
                  value={ipInfo}
                  onChange={(e) => setIpInfo(e.target.value)}
                  placeholder="e.g., PC1: 10.20.0.15/24 GW 10.20.0.1"
                  className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Networking Concept
                </label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="e.g., OSPF, VLAN Trunk, ACL, NAT"
                  className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {topology.trim() && (
          <div>
            <div className="text-xs font-medium text-slate-400 mb-1.5">Topology Preview</div>
            <TopologyDiagram topology={topology} />
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-cyan-400" />
              Show Command Output <span className="text-rose-400">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 mr-1">Insert sample:</span>
              {CLI_SNIPPETS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() =>
                    setCommandOutput((prev) => (prev.trim() ? `${prev.trim()}\n\n${s.snippet}` : s.snippet))
                  }
                  className="rounded border border-[#22365E] bg-[#0D182E] px-2 py-1 font-mono text-[11px] text-cyan-300 hover:bg-[#152547] cursor-pointer"
                >
                  + {s.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={9}
            required
            value={commandOutput}
            onChange={(e) => setCommandOutput(e.target.value)}
            placeholder="Paste output from show ip interface brief, show running-config, show ip route, show vlan brief, show interfaces trunk, show access-lists, ping, etc."
            className="w-full rounded-lg border border-[#22365E] bg-[#050A14] px-3.5 py-2.5 font-mono text-xs leading-relaxed text-cyan-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Additional Evidence / Running Configuration Notes (Optional)
          </label>
          <textarea
            rows={3}
            value={additionalEvidence}
            onChange={(e) => setAdditionalEvidence(e.target.value)}
            placeholder="Recent configuration changes, syslog messages, or Packet Tracer link indicator observations..."
            className="w-full rounded-lg border border-[#22365E] bg-[#070E1C] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/35 px-4 py-3 text-xs text-rose-200 flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="submit"
            disabled={diagnosing}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {diagnosing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running Custom AI Diagnosis...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Diagnose Custom Problem
              </>
            )}
          </button>
        </div>
      </form>

      {resultRecord && !diagnosing && (
        <DiagnosisResultPanel
          record={resultRecord}
          isPredefinedCase={false}
          onEvaluate={async (id) => {
            await onEvaluate(id);
          }}
          onReview={handleReview}
          reviewing={reviewing}
        />
      )}
    </div>
  );
}
