import csv
import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from database import (
    CASES_CSV_PATH,
    get_history_by_id,
    init_database,
    insert_history_record,
    list_batch_runs,
    list_history,
    save_batch_run,
    update_history_evaluation,
    update_history_review,
)
from evaluator import evaluate_diagnosis

load_dotenv()

app = FastAPI(
    title="NetAI Network Troubleshooting API",
    description="Intelligent AI-based Cisco network troubleshooting, evaluation, and human expert review API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_database()


def load_cases_csv() -> List[Dict[str, str]]:
    if not CASES_CSV_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Dataset file not found: {CASES_CSV_PATH}")
    with CASES_CSV_PATH.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return [{k: (v or "").strip() for k, v in row.items()} for row in reader if row.get("case_id")]


class DiagnoseRequest(BaseModel):
    case_id: Optional[str] = None
    is_custom: bool = False
    title: Optional[str] = None
    symptom: Optional[str] = None
    topology: Optional[str] = ""
    ip_info: Optional[str] = ""
    command_output: Optional[str] = None
    additional_evidence: Optional[str] = ""
    severity: Optional[str] = "Medium"
    concept: Optional[str] = ""
    osi_layer: Optional[str] = ""
    expected_behavior: Optional[str] = ""
    actual_behavior: Optional[str] = ""
    auto_evaluate: bool = False
    batch_run_id: Optional[str] = None


class EvaluateRequest(BaseModel):
    history_id: Optional[int] = None
    case_id: Optional[str] = None
    problem: Optional[str] = ""
    root_cause: Optional[str] = ""
    confidence: Optional[str] = ""
    osi_layer: Optional[str] = ""
    evidence: List[str] = Field(default_factory=list)
    recommended_fix: Optional[str] = ""
    next_command: Optional[str] = ""


class ReviewRequest(BaseModel):
    history_id: int
    action: str
    reason: Optional[str] = None
    problem: Optional[str] = None
    root_cause: Optional[str] = None
    evidence: Optional[List[str]] = None
    recommended_fix: Optional[str] = None
    next_command: Optional[str] = None
    osi_layer: Optional[str] = None
    confidence: Optional[str] = None


class BatchRunRequest(BaseModel):
    id: str
    timestamp: str
    total_cases: int
    passed_cases: int
    failed_cases: int
    untested_cases: int
    accuracy: float
    status: str


SYSTEM_INSTRUCTION = (
    "You are NetAI, a senior CCIE-level enterprise network troubleshooting and Cisco IOS fault diagnosis engine. "
    "Analyze the provided networking case evidence strictly. NEVER invent IP addresses, interfaces, VLAN IDs, "
    "configurations, or commands not present in the provided evidence. Return structured JSON only."
)


def call_gemini_diagnosis(prompt: str) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "MY_GEMINI_API_KEY":
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured in environment.")

    client = genai.Client(api_key=api_key)
    schema = {
        "type": "OBJECT",
        "properties": {
            "problem": {"type": "STRING"},
            "root_cause": {"type": "STRING"},
            "confidence": {"type": "STRING"},
            "osi_layer": {"type": "STRING"},
            "evidence": {"type": "ARRAY", "items": {"type": "STRING"}},
            "recommended_fix": {"type": "STRING"},
            "next_command": {"type": "STRING"},
        },
        "required": [
            "problem",
            "root_cause",
            "confidence",
            "osi_layer",
            "evidence",
            "recommended_fix",
            "next_command",
        ],
    }

    try:
        response = client.models.generate_content(
            model="gemini-4-hydrogen",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
        raw_text = (response.text or "").strip()
        if not raw_text:
            raise HTTPException(status_code=502, detail="Gemini returned an empty response.")
        return json.loads(raw_text)
    except HTTPException:
        raise
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Invalid AI JSON response: {exc}") from exc
    except Exception as exc:
        msg = str(exc)
        status = 429 if "429" in msg or "RESOURCE_EXHAUSTED" in msg else 502
        raise HTTPException(status_code=status, detail=f"Gemini API error: {msg}") from exc


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    init_database()
    cases = load_cases_csv()
    key = os.getenv("GEMINI_API_KEY", "").strip()
    return {
        "status": "ok",
        "database": "connected",
        "dataset_loaded": True,
        "cases_count": len(cases),
        "ai_configured": bool(key and key != "MY_GEMINI_API_KEY"),
        "model": "gemini-2.5-flash",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/cases")
def get_cases(
    search: Optional[str] = Query(default=None),
    osi_layer: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    cases = load_cases_csv()
    if osi_layer and osi_layer.upper() != "ALL":
        cases = [c for c in cases if osi_layer.lower() in c.get("osi_layer", "").lower()]
    if severity and severity.upper() != "ALL":
        cases = [c for c in cases if c.get("severity", "").lower() == severity.lower()]
    if search and search.strip():
        q = search.strip().lower()
        cases = [
            c
            for c in cases
            if q in c.get("case_id", "").lower()
            or q in c.get("title", "").lower()
            or q in c.get("symptom", "").lower()
            or q in c.get("concept", "").lower()
            or q in c.get("ip_info", "").lower()
            or q in c.get("command_output", "").lower()
        ]
    return {"cases": cases, "total": len(cases)}


@app.get("/api/cases/{case_id}")
def get_case(case_id: str) -> Dict[str, Any]:
    cases = load_cases_csv()
    for c in cases:
        if c["case_id"].upper() == case_id.upper():
            return {"case": c}
    raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")


@app.post("/api/diagnose")
def diagnose(req: DiagnoseRequest) -> Dict[str, Any]:
    cases = load_cases_csv()
    matched_case = None
    case_id = (req.case_id or "").strip()

    if not req.is_custom:
        if not case_id:
            raise HTTPException(status_code=400, detail="case_id is required for predefined diagnosis.")
        matched_case = next((c for c in cases if c["case_id"].upper() == case_id.upper()), None)
        if not matched_case:
            raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
        title = req.title or matched_case["title"]
        symptom = req.symptom or matched_case["symptom"]
        topology = req.topology or matched_case["topology"]
        ip_info = req.ip_info or matched_case["ip_info"]
        command_output = req.command_output or matched_case["command_output"]
        severity = matched_case["severity"]
        osi_expected = matched_case["osi_layer"]
        concept_hint = matched_case["concept"]
    else:
        if not req.symptom or not req.command_output:
            raise HTTPException(status_code=400, detail="symptom and command_output are required for custom diagnosis.")
        if not case_id:
            case_id = f"CUSTOM-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        title = req.title or f"Custom Diagnosis ({case_id})"
        symptom = req.symptom
        topology = req.topology or ""
        ip_info = req.ip_info or ""
        command_output = req.command_output
        severity = req.severity or "Medium"
        osi_expected = req.osi_layer or ""
        concept_hint = req.concept or ""

    prompt = (
        f"Case ID: {case_id}\nTitle: {title}\nSeverity: {severity}\n"
        f"Concept: {concept_hint}\nOSI Hint: {osi_expected}\n"
        f"Symptom:\n{symptom}\n\nTopology:\n{topology}\n\nIP Info:\n{ip_info}\n\n"
        f"Command Output:\n{command_output}\n\nAdditional Evidence:\n{req.additional_evidence or ''}"
    )
    ai_result = call_gemini_diagnosis(prompt)

    evidence_snapshot = json.dumps({
        "topology": topology,
        "ip_info": ip_info,
        "command_output": command_output,
        "additional_evidence": req.additional_evidence or "",
        "symptom": symptom,
    })

    record = insert_history_record({
        "case_id": case_id,
        "case_title": title,
        "osi_layer_expected": osi_expected or ai_result.get("osi_layer", ""),
        "severity": severity,
        "is_custom": req.is_custom,
        "evidence_used": evidence_snapshot,
        "problem": ai_result["problem"],
        "root_cause": ai_result["root_cause"],
        "evidence": ai_result.get("evidence", []),
        "recommended_fix": ai_result["recommended_fix"],
        "next_command": ai_result["next_command"],
        "osi_layer": ai_result["osi_layer"],
        "confidence": ai_result["confidence"],
        "batch_run_id": req.batch_run_id,
    })

    if req.auto_evaluate and matched_case:
        eval_details = evaluate_diagnosis(ai_result, matched_case)
        record = update_history_evaluation(record["id"], eval_details["verdict"], eval_details)

    return {"record": record, "diagnosis": ai_result}


@app.post("/api/evaluate")
def evaluate(req: EvaluateRequest) -> Dict[str, Any]:
    cases = load_cases_csv()
    existing = get_history_by_id(req.history_id) if req.history_id else None
    if req.history_id and not existing:
        raise HTTPException(status_code=404, detail=f"History record #{req.history_id} not found.")

    case_id = (existing["case_id"] if existing else req.case_id) or ""
    ref_case = next((c for c in cases if c["case_id"].upper() == case_id.upper()), None)
    if not ref_case:
        raise HTTPException(status_code=404, detail=f"No ground-truth reference case found for '{case_id}'.")

    candidate = existing if existing else req.model_dump()
    evaluation = evaluate_diagnosis(candidate, ref_case)

    if existing:
        existing = update_history_evaluation(existing["id"], evaluation["verdict"], evaluation)

    return {"evaluation": evaluation, "record": existing}


@app.post("/api/review")
def review(req: ReviewRequest) -> Dict[str, Any]:
    try:
        updated = update_history_review(req.history_id, req.model_dump())
        return {"record": updated}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/history")
def get_history(
    case_id: Optional[str] = None,
    evaluation_status: Optional[str] = None,
    review_status: Optional[str] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    records = list_history(case_id, evaluation_status, review_status, search)
    return {"history": records, "total": len(records)}


@app.get("/api/stats")
def get_stats() -> Dict[str, Any]:
    cases = load_cases_csv()
    case_map = {c["case_id"].upper(): c for c in cases}
    records = list_history()

    total_runs = len(records)
    passed = sum(1 for r in records if r["evaluation_status"] == "PASS")
    failed = sum(1 for r in records if r["evaluation_status"] == "FAIL")
    untested = sum(1 for r in records if r["evaluation_status"] == "UNTESTED")
    evaluated = passed + failed
    accuracy = round((passed / evaluated) * 100, 1) if evaluated > 0 else 0.0

    review_stats = {
        "pending": sum(1 for r in records if r["review_status"] == "Pending Review"),
        "accepted": sum(1 for r in records if r["review_status"] == "Accepted"),
        "edited": sum(1 for r in records if r["review_status"] == "Edited"),
        "rejected": sum(1 for r in records if r["review_status"] == "Rejected"),
    }

    layers = [f"Layer {i}" for i in range(1, 8)]
    layer_buckets = {l: {"total": 0, "passed": 0, "failed": 0, "untested": 0} for l in layers}
    severities = ["Critical", "High", "Medium", "Low"]
    sev_buckets = {s: {"total": 0, "passed": 0, "failed": 0, "untested": 0} for s in severities}

    for r in records:
        ref = case_map.get(r["case_id"].upper())
        raw_layer = (ref["osi_layer"] if ref else r["osi_layer_expected"]) or r["osi_layer"]
        m = re.search(r"Layer\s*([1-7])", raw_layer, re.IGNORECASE)
        lkey = f"Layer {m.group(1)}" if m else "Layer 3"
        layer_buckets[lkey]["total"] += 1
        if r["evaluation_status"] == "PASS":
            layer_buckets[lkey]["passed"] += 1
        elif r["evaluation_status"] == "FAIL":
            layer_buckets[lkey]["failed"] += 1
        else:
            layer_buckets[lkey]["untested"] += 1

        raw_sev = (ref["severity"] if ref else r["severity"]) or "Medium"
        skey = next((s for s in severities if s.lower() == raw_sev.lower()), "Medium")
        sev_buckets[skey]["total"] += 1
        if r["evaluation_status"] == "PASS":
            sev_buckets[skey]["passed"] += 1
        elif r["evaluation_status"] == "FAIL":
            sev_buckets[skey]["failed"] += 1
        else:
            sev_buckets[skey]["untested"] += 1

    layer_accuracy = [
        {
            "layer": l,
            **b,
            "accuracy": round((b["passed"] / (b["passed"] + b["failed"])) * 100, 1)
            if (b["passed"] + b["failed"]) > 0
            else 0.0,
        }
        for l, b in layer_buckets.items()
    ]

    severity_accuracy = [
        {
            "severity": s,
            **b,
            "accuracy": round((b["passed"] / (b["passed"] + b["failed"])) * 100, 1)
            if (b["passed"] + b["failed"]) > 0
            else 0.0,
        }
        for s, b in sev_buckets.items()
    ]

    return {
        "total_cases_in_dataset": len(cases),
        "total_runs": total_runs,
        "passed_runs": passed,
        "failed_runs": failed,
        "untested_runs": untested,
        "evaluated_runs": evaluated,
        "overall_accuracy": accuracy,
        "review_stats": review_stats,
        "layer_accuracy": layer_accuracy,
        "severity_accuracy": severity_accuracy,
        "recent_activity": records[:8],
    }


@app.get("/api/batches")
def get_batches() -> Dict[str, Any]:
    return {"batches": list_batch_runs()}


@app.post("/api/batches")
def create_batch(req: BatchRunRequest) -> Dict[str, Any]:
    return {"batch": save_batch_run(req.model_dump())}
