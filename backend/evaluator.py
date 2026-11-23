import re
from typing import Any, Dict, List

STOP_WORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "onto", "over",
    "under", "between", "across", "when", "where", "which", "while", "both", "each",
    "only", "must", "should", "could", "would", "cannot", "failed", "failing", "fails",
    "using", "configured", "configure", "interface", "interfaces", "network", "router",
    "switch", "device", "packet", "traffic", "system", "cause", "causing", "because",
    "being", "been", "have", "has", "are", "was", "were", "not", "but", "all", "any",
    "due", "instead", "mode", "state", "link", "line", "port", "ports", "enter",
    "execute", "command", "verify", "update", "change", "add", "set", "use", "match",
}


def _normalize(text: str) -> str:
    t = text.lower()
    t = t.replace("gigabitethernet", "gi")
    t = t.replace("fastethernet", "fa")
    t = t.replace("tengigabitethernet", "te")
    t = t.replace("port-channel", "po")
    return re.sub(r"[^a-z0-9./:_-]+", " ", t).strip()


def _extract_keywords(text: str) -> List[str]:
    tokens = [tok for tok in _normalize(text).split() if len(tok) >= 2 and tok not in STOP_WORDS]
    return list(dict.fromkeys(tokens))


def _extract_technical_tokens(text: str) -> List[str]:
    matches: List[str] = []
    matches.extend(re.findall(r"\b\d{1,3}(?:\.\d{1,3}){3}(?:/\d{1,2})?\b", text))
    matches.extend(
        _normalize(m).replace(" ", "")
        for m in re.findall(
            r"\b(?:gi|gigabitethernet|fa|fastethernet|te|tengigabitethernet|vlan|tunnel|po|loopback)\s*\d+(?:/\d+)*(?:\.\d+)?\b",
            text,
            flags=re.IGNORECASE,
        )
    )
    matches.extend(
        _normalize(m)
        for m in re.findall(
            r"\b(?:vlan\s*\d+|area\s*\d+|as\s*\d+|remote-as\s*\d+|group\s*\d+|standby\s*\d+|eq\s*\d+|port\s*\d+|mtu\s*\d+|dot1q\s*\d+|priority\s*\d+|acl\s*\w+)\b",
            text,
            flags=re.IGNORECASE,
        )
    )
    return list(dict.fromkeys(m.lower() for m in matches))


def _extract_layer_num(layer_str: str) -> str:
    m = re.search(r"(?:layer\s*)?([1-7])", layer_str, flags=re.IGNORECASE)
    if m:
        return m.group(1)
    lower = layer_str.lower()
    mapping = {
        "physical": "1",
        "data link": "2",
        "datalink": "2",
        "network": "3",
        "transport": "4",
        "session": "5",
        "presentation": "6",
        "application": "7",
    }
    for k, v in mapping.items():
        if k in lower:
            return v
    return ""


def evaluate_diagnosis(diagnosis: Dict[str, Any], reference_case: Dict[str, str]) -> Dict[str, Any]:
    checks: List[Dict[str, Any]] = []
    evidence_list = diagnosis.get("evidence") or []

    diag_cause = _normalize(f"{diagnosis.get('problem', '')} {diagnosis.get('root_cause', '')}")
    diag_fix = _normalize(f"{diagnosis.get('recommended_fix', '')} {diagnosis.get('next_command', '')}")
    diag_all = _normalize(
        f"{diagnosis.get('problem', '')} {diagnosis.get('root_cause', '')} {' '.join(evidence_list)} "
        f"{diagnosis.get('recommended_fix', '')} {diagnosis.get('next_command', '')}"
    )

    # 1. Root Cause Check
    fault_kws = _extract_keywords(reference_case.get("expected_fault", ""))
    matched_fault = [k for k in fault_kws if k in diag_cause]
    fault_ratio = len(matched_fault) / len(fault_kws) if fault_kws else 1.0
    rc_pass = fault_ratio >= 0.35 or len(matched_fault) >= 2
    checks.append({
        "name": "Root Cause Identification",
        "passed": rc_pass,
        "score": round(min(1.0, fault_ratio * 1.5) * 100),
        "detail": (
            f"Matched {len(matched_fault)}/{len(fault_kws)} root-cause indicators ({', '.join(matched_fault[:5])})."
            if rc_pass
            else f"Insufficient alignment with expected fault: {reference_case.get('expected_fault', '')}"
        ),
    })

    # 2. Recommended Fix Check
    fix_kws = _extract_keywords(reference_case.get("expected_fix", ""))
    matched_fix = [k for k in fix_kws if k in diag_fix]
    fix_ratio = len(matched_fix) / len(fix_kws) if fix_kws else 1.0
    fix_pass = fix_ratio >= 0.3 or len(matched_fix) >= 2
    checks.append({
        "name": "Recommended Fix Correctness",
        "passed": fix_pass,
        "score": round(min(1.0, fix_ratio * 1.6) * 100),
        "detail": (
            f"Remediation captures corrective actions ({', '.join(matched_fix[:5])})."
            if fix_pass
            else f"Recommended fix misses required actions from expected fix."
        ),
    })

    # 3. Networking Keywords Check
    concept_kws = _extract_keywords(f"{reference_case.get('concept', '')} {reference_case.get('title', '')}")
    matched_concept = [k for k in concept_kws if k in diag_all]
    concept_ratio = len(matched_concept) / len(concept_kws) if concept_kws else 1.0
    kw_pass = concept_ratio >= 0.3 or len(matched_concept) >= 2
    checks.append({
        "name": "Networking Keywords & Protocol Accuracy",
        "passed": kw_pass,
        "score": round(min(1.0, concept_ratio * 1.5) * 100),
        "detail": (
            f"Accurately identifies concepts: {', '.join(matched_concept[:6])}."
            if kw_pass
            else "Missing core networking protocol terminology."
        ),
    })

    # 4. Configuration Grounding Check
    expected_tech = _extract_technical_tokens(
        f"{reference_case.get('expected_fault', '')} {reference_case.get('expected_fix', '')} {reference_case.get('ip_info', '')}"
    )
    diag_nospace = diag_all.replace(" ", "")
    matched_tech = [t for t in expected_tech if t in diag_all or t.replace(" ", "") in diag_nospace]
    cfg_pass = len(expected_tech) == 0 or len(matched_tech) >= 1
    tech_ratio = len(matched_tech) / len(expected_tech) if expected_tech else 1.0
    checks.append({
        "name": "Configuration Details & Topology Grounding",
        "passed": cfg_pass,
        "score": round(min(1.0, max(tech_ratio, 0.8 if matched_tech else 0.0) if expected_tech else 1.0) * 100),
        "detail": (
            f"Grounded in observed case entities: {', '.join(matched_tech[:5])}."
            if cfg_pass
            else "Expected IP/interface configuration identifiers were not referenced."
        ),
    })

    # 5. OSI Layer Classification Check
    exp_layer = _extract_layer_num(reference_case.get("osi_layer", ""))
    act_layer = _extract_layer_num(diagnosis.get("osi_layer", ""))
    osi_pass = bool(exp_layer) and exp_layer == act_layer
    checks.append({
        "name": "OSI Layer Classification",
        "passed": osi_pass,
        "score": 100 if osi_pass else 0,
        "detail": (
            f"Correctly classified at {reference_case.get('osi_layer')}."
            if osi_pass
            else f"Expected {reference_case.get('osi_layer')}, got '{diagnosis.get('osi_layer')}'."
        ),
    })

    passed_count = sum(1 for c in checks if c["passed"])
    total_count = len(checks)
    overall_score = round(sum(c["score"] for c in checks) / total_count)
    verdict = "PASS" if (rc_pass and fix_pass and passed_count >= 4) else "FAIL"

    summary = (
        f"PASS – Diagnosis meets evaluation rules ({passed_count}/{total_count} checks passed, {overall_score}% match)."
        if verdict == "PASS"
        else f"FAIL – Diagnosis does not meet evaluation rules ({passed_count}/{total_count} checks passed, {overall_score}% match)."
    )

    return {
        "verdict": verdict,
        "overall_score": overall_score,
        "passed_checks": passed_count,
        "total_checks": total_count,
        "checks": checks,
        "summary": summary,
    }
