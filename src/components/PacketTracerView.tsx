import { useState } from 'react';
import { Terminal, ArrowRight, Copy, Check, Info, Network } from 'lucide-react';
import { TopologyDiagram } from './TopologyDiagram';

interface PacketTracerViewProps {
  onSendToCustomDiagnosis: (commandOutput: string) => void;
  onOpenCase01: () => void;
}

interface CommandTemplate {
  command: string;
  osiLayer: string;
  purpose: string;
  sampleOutput: string;
}

const COMMAND_TEMPLATES: CommandTemplate[] = [
  {
    command: 'show ip interface brief',
    osiLayer: 'Layer 1 / Layer 3',
    purpose: 'Verify interface IP addresses, physical status (up/down/administratively down), and line protocol state.',
    sampleOutput: `R1# show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     192.168.1.1     YES manual administratively down down
GigabitEthernet0/1     10.0.12.1       YES manual up                    up
Vlan1                  unassigned      YES unset  administratively down down`,
  },
  {
    command: 'show running-config',
    osiLayer: 'All Layers',
    purpose: 'Inspect active router/switch configuration including interfaces, routing protocols, ACLs, NAT, and subinterfaces.',
    sampleOutput: `R1# show running-config
interface GigabitEthernet0/0
 ip address 192.168.1.1 255.255.255.0
 shutdown
!
interface GigabitEthernet0/1
 ip address 10.0.12.1 255.255.255.252
 no shutdown`,
  },
  {
    command: 'show ip route',
    osiLayer: 'Layer 3',
    purpose: 'Inspect the IPv4 routing table (connected, static, OSPF, EIGRP, BGP, and default gateway routes).',
    sampleOutput: `R1# show ip route
Codes: C - connected, L - local, S - static, O - OSPF, D - EIGRP
Gateway of last resort is not set

     10.0.0.0/8 is variably subnetted, 2 subnets, 2 masks
C       10.0.12.0/30 is directly connected, GigabitEthernet0/1
L       10.0.12.1/32 is directly connected, GigabitEthernet0/1`,
  },
  {
    command: 'show vlan brief',
    osiLayer: 'Layer 2',
    purpose: 'Verify VLAN creation, active status, and switch access port membership.',
    sampleOutput: `SW1# show vlan brief
VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Fa0/1, Fa0/2, Fa0/3
10   Sales                            active    Fa0/4, Fa0/5
20   Finance                          active    Fa0/6, Fa0/7
99   Management                       active    Gi0/1`,
  },
  {
    command: 'show interfaces trunk',
    osiLayer: 'Layer 2',
    purpose: 'Verify 802.1Q trunk status, native VLAN alignment, and VLANs allowed/forwarding across trunks.',
    sampleOutput: `SW1# show interfaces trunk
Port        Mode             Encapsulation  Status        Native vlan
Gi0/1       on               802.1q         trunking      99

Port        Vlans allowed on trunk
Gi0/1       1,10,99`,
  },
  {
    command: 'show access-lists',
    osiLayer: 'Layer 3 / Layer 4',
    purpose: 'Inspect standard/extended ACL rules and hit counts to detect blocked ports or implicit deny drops.',
    sampleOutput: `R-DMZ# show access-lists
Extended IP access list DMZ_OUT
    10 permit icmp any host 172.16.50.10 (48 matches)
    20 permit tcp any host 172.16.50.10 eq 22 (12 matches)
    (implicit deny ip any any - 314 matches)`,
  },
  {
    command: 'show arp',
    osiLayer: 'Layer 2 / Layer 3',
    purpose: 'Check IP-to-MAC address bindings and detect missing ARP resolution or duplicate IP MAC flapping.',
    sampleOutput: `R1# show arp
Protocol  Address          Age (min)  Hardware Addr   Type   Interface
Internet  192.168.1.1             -   0001.6422.1101  ARPA   GigabitEthernet0/0
Internet  192.168.1.10            2   0050.5688.1204  ARPA   GigabitEthernet0/0`,
  },
  {
    command: 'show ip ospf neighbor',
    osiLayer: 'Layer 3',
    purpose: 'Verify OSPF neighbor adjacency states (FULL, 2WAY, INIT, EXSTART) and dead timers.',
    sampleOutput: `R1# show ip ospf neighbor
Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           1   FULL/DR         00:00:36    10.0.12.2       GigabitEthernet0/1`,
  },
  {
    command: 'ipconfig',
    osiLayer: 'Layer 3 / Layer 7',
    purpose: 'Inspect endpoint IPv4 address, subnet mask, default gateway, and DNS server configuration.',
    sampleOutput: `PC1> ipconfig
IPv4 Address. . . . . . . . . . . : 192.168.1.10
Subnet Mask . . . . . . . . . . . : 255.255.255.0
Default Gateway . . . . . . . . . : 192.168.1.1`,
  },
  {
    command: 'ping',
    osiLayer: 'Layer 3',
    purpose: 'Test end-to-end ICMP reachability, round-trip latency, and packet loss across hops.',
    sampleOutput: `PC1> ping 192.168.1.1
Pinging 192.168.1.1 with 32 bytes of data:
Request timed out.
Request timed out.
Ping statistics for 192.168.1.1:
    Packets: Sent = 2, Received = 0, Lost = 2 (100% loss)`,
  },
];

export function PacketTracerView({
  onSendToCustomDiagnosis,
  onOpenCase01,
}: PacketTracerViewProps) {
  const [selectedCmd, setSelectedCmd] = useState<CommandTemplate>(COMMAND_TEMPLATES[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedCmd.sampleOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            Cisco Packet Tracer Workbench &amp; CLI Reference
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Capture Cisco IOS or PC CLI outputs from your Packet Tracer lab and diagnose them with NetAI.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCase01}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          Inspect Case01 Lab Scenario
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Transparent Scope Disclosure */}
      <div className="rounded-xl border border-[#22365E] bg-[#0B1426] p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-slate-100">Packet Tracer Workflow Note: </span>
          NetAI does not directly attach to or automatically execute commands inside a running Cisco Packet Tracer binary. Instead, run diagnostic commands inside your Packet Tracer device CLI (such as <code className="font-mono text-cyan-300">Case01_Broken.pkt</code> vs <code className="font-mono text-cyan-300">Case01_Working.pkt</code>) and paste the resulting output into NetAI&apos;s Evidence Editor or Custom Diagnosis module.
        </div>
      </div>

      {/* Case01_Broken vs Case01_Working Topology Reference */}
      <div className="rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Network className="h-4 w-4 text-cyan-400" />
              Case 01 Reference Topology (Case01_Broken.pkt / Case01_Working.pkt)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Compare R1 GigabitEthernet0/0 state between broken and working lab snapshots.
            </p>
          </div>
          <span className="font-mono text-xs text-cyan-400">CASE-001 · Layer 1</span>
        </div>

        <TopologyDiagram topology="PC1 (Fa0) -> SW1 (Fa0/1 -> Gi0/1) -> R1 (Gi0/0) -> R2 (Gi0/1) -> Server1" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-4 space-y-2">
            <div className="text-xs font-semibold text-rose-300">Case01_Broken.pkt State</div>
            <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
{`R1# show ip interface brief
GigabitEthernet0/0  192.168.1.1  YES manual administratively down down
GigabitEthernet0/1  10.0.12.1    YES manual up                    up`}
            </pre>
          </div>

          <div className="rounded-lg border border-[#1B2B4B] bg-[#081020] p-4 space-y-2">
            <div className="text-xs font-semibold text-emerald-300">Case01_Working.pkt State (After &ldquo;no shutdown&rdquo;)</div>
            <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
{`R1# show ip interface brief
GigabitEthernet0/0  192.168.1.1  YES manual up                    up
GigabitEthernet0/1  10.0.12.1    YES manual up                    up`}
            </pre>
          </div>
        </div>
      </div>

      {/* Supported Cisco CLI Commands Explorer */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-xl border border-[#1B2B4B] bg-[#0B1426] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1A2B4C] text-xs font-semibold text-slate-200">
            Supported Cisco IOS &amp; Endpoint Commands
          </div>
          <div className="divide-y divide-[#15233E]">
            {COMMAND_TEMPLATES.map((tpl) => {
              const active = selectedCmd.command === tpl.command;
              return (
                <button
                  key={tpl.command}
                  type="button"
                  onClick={() => setSelectedCmd(tpl)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    active ? 'bg-[#122242]' : 'hover:bg-[#0E1930]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-cyan-300">
                      {tpl.command}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{tpl.purpose}</div>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                    {tpl.osiLayer}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-[#1B2B4B] bg-[#0B1426] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-400" />
                <span className="font-mono text-sm font-semibold text-slate-100">
                  {selectedCmd.command}
                </span>
              </div>
              <span className="text-xs text-slate-400">{selectedCmd.osiLayer}</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{selectedCmd.purpose}</p>

            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-slate-400">Sample CLI Output</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-300 hover:bg-[#14223E] cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Output</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="rounded-lg border border-[#1B2B4B] bg-[#050A14] p-4 font-mono text-xs leading-relaxed text-cyan-100 overflow-x-auto whitespace-pre-wrap">
                {selectedCmd.sampleOutput}
              </pre>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onSendToCustomDiagnosis(selectedCmd.sampleOutput)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors cursor-pointer"
            >
              Use Output in Custom Diagnosis
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
