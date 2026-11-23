# Packet Tracer Lab Guide: Case 01 (`Case01_Broken.pkt` vs `Case01_Working.pkt`)

## Scenario Overview
Workstations in `LAN-A` (`192.168.1.0/24`) cannot ping their default gateway (`192.168.1.1`) or reach `Server1` on the remote subnet.

### Topology
`PC1 (Fa0) -> SW1 (Fa0/1 -> Gi0/1) -> R1 (Gi0/0) -> R2 (Gi0/1) -> Server1`

- **PC1**: `192.168.1.10 / 255.255.255.0`, Default Gateway `192.168.1.1`
- **R1 Gi0/0**: `192.168.1.1 / 255.255.255.0`
- **R1 Gi0/1**: `10.0.12.1 / 255.255.255.252`

## Inspecting `Case01_Broken.pkt`
In Cisco Packet Tracer CLI on `R1`:
```text
R1# show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     192.168.1.1     YES manual administratively down down
GigabitEthernet0/1     10.0.12.1       YES manual up                    up
```
Paste this output into NetAI (`CASE-001` or Custom Diagnosis). NetAI identifies the Layer 1 administrative shutdown on `GigabitEthernet0/0` and recommends `no shutdown`.

## Applying Fix (`Case01_Working.pkt`)
```text
R1# configure terminal
R1(config)# interface GigabitEthernet0/0
R1(config-if)# no shutdown
R1(config-if)# end
R1# show ip interface brief
```
Once `GigabitEthernet0/0` transitions to `up / up`, `PC1> ping 192.168.1.1` succeeds.
