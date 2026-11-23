import { Monitor, Router, Server, Shield, HardDrive, Wifi } from 'lucide-react';

interface TopologyNode {
  label: string;
  portHint?: string;
  type: 'host' | 'switch' | 'router' | 'server' | 'firewall' | 'ap';
}

function detectNodeType(label: string): TopologyNode['type'] {
  const lower = label.toLowerCase();
  if (lower.includes('fw') || lower.includes('firewall')) return 'firewall';
  if (lower.includes('server') || lower.includes('srv') || lower.includes('db') || lower.includes('web') || lower.includes('dns') || lower.includes('dhcp') || lower.includes('tacacs')) return 'server';
  if (lower.includes('sw') || lower.includes('ds1')) return 'switch';
  if (lower.includes('ap')) return 'ap';
  if (lower.startsWith('r') || lower.includes('router') || lower.includes('core-r') || lower.includes('branch') || lower.includes('isp')) return 'router';
  return 'host';
}

function parseTopology(topology: string): TopologyNode[] {
  const primarySegment = topology.split('|')[0]?.trim() || topology;
  const parts = primarySegment
    .split(/\s*(?:->|===|---)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.map((raw) => {
    const match = raw.match(/^([^(]+?)(?:\s*\(([^)]+)\))?$/);
    const label = (match?.[1] || raw).trim();
    const portHint = match?.[2]?.trim();
    return {
      label,
      portHint,
      type: detectNodeType(label),
    };
  });
}

function NodeIcon({ type }: { type: TopologyNode['type'] }) {
  switch (type) {
    case 'router':
      return <Router className="h-4 w-4 text-cyan-400" />;
    case 'switch':
      return <HardDrive className="h-4 w-4 text-blue-400" />;
    case 'server':
      return <Server className="h-4 w-4 text-sky-300" />;
    case 'firewall':
      return <Shield className="h-4 w-4 text-amber-400" />;
    case 'ap':
      return <Wifi className="h-4 w-4 text-cyan-300" />;
    default:
      return <Monitor className="h-4 w-4 text-slate-300" />;
  }
}

export function TopologyDiagram({ topology }: { topology: string }) {
  const nodes = parseTopology(topology);

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-[#1B2B4B] bg-[#081021] px-4 py-3 text-sm text-slate-400">
        No topology path specified.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#1B2B4B] bg-[#081021] p-4">
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        {nodes.map((node, idx) => (
          <div key={`${node.label}-${idx}`} className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2.5 rounded-md border border-[#22365E] bg-[#0E1A33] px-3 py-2">
              <NodeIcon type={node.type} />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100 whitespace-nowrap">{node.label}</div>
                {node.portHint && (
                  <div className="font-mono text-[11px] text-cyan-300/85 whitespace-nowrap">
                    {node.portHint}
                  </div>
                )}
              </div>
            </div>
            {idx < nodes.length - 1 && (
              <div className="flex items-center px-1" aria-hidden="true">
                <div className="h-px w-5 bg-cyan-500/45" />
                <div className="h-1.5 w-1.5 rotate-45 border-t border-r border-cyan-400/70 -ml-1" />
              </div>
            )}
          </div>
        ))}
      </div>
      {topology.includes('|') && (
        <p className="mt-2.5 font-mono text-xs text-slate-400">
          Full path: {topology}
        </p>
      )}
    </div>
  );
}
