import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "netsage.db"
CASES_CSV_PATH = DATA_DIR / "cases.csv"


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_database() -> None:
    conn = get_connection()
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                case_title TEXT DEFAULT '',
                osi_layer_expected TEXT DEFAULT '',
                severity TEXT DEFAULT 'Medium',
                is_custom INTEGER DEFAULT 0,
                timestamp TEXT NOT NULL,
                evidence_used TEXT NOT NULL,
                problem TEXT NOT NULL,
                root_cause TEXT NOT NULL,
                evidence TEXT NOT NULL,
                recommended_fix TEXT NOT NULL,
                next_command TEXT NOT NULL,
                osi_layer TEXT NOT NULL,
                confidence TEXT NOT NULL,
                evaluation_status TEXT DEFAULT 'UNTESTED',
                evaluation_details TEXT,
                review_status TEXT DEFAULT 'Pending Review',
                review_reason TEXT,
                reviewed_at TEXT,
                original_problem TEXT NOT NULL,
                original_root_cause TEXT NOT NULL,
                original_evidence TEXT NOT NULL,
                original_recommended_fix TEXT NOT NULL,
                original_next_command TEXT NOT NULL,
                original_osi_layer TEXT NOT NULL,
                original_confidence TEXT NOT NULL,
                batch_run_id TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS batch_runs (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                total_cases INTEGER NOT NULL,
                passed_cases INTEGER NOT NULL,
                failed_cases INTEGER NOT NULL,
                untested_cases INTEGER NOT NULL,
                accuracy REAL NOT NULL,
                status TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def _safe_json_loads(val: Optional[str], fallback: Any) -> Any:
    if not val:
        return fallback
    try:
        return json.loads(val)
    except Exception:
        return fallback


def _row_to_history(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "case_id": row["case_id"],
        "case_title": row["case_title"] or "",
        "osi_layer_expected": row["osi_layer_expected"] or "",
        "severity": row["severity"] or "Medium",
        "is_custom": row["is_custom"],
        "timestamp": row["timestamp"],
        "evidence_used": row["evidence_used"],
        "problem": row["problem"],
        "root_cause": row["root_cause"],
        "evidence": _safe_json_loads(row["evidence"], []),
        "recommended_fix": row["recommended_fix"],
        "next_command": row["next_command"],
        "osi_layer": row["osi_layer"],
        "confidence": row["confidence"],
        "evaluation_status": row["evaluation_status"] or "UNTESTED",
        "evaluation_details": _safe_json_loads(row["evaluation_details"], None),
        "review_status": row["review_status"] or "Pending Review",
        "review_reason": row["review_reason"],
        "reviewed_at": row["reviewed_at"],
        "original_problem": row["original_problem"],
        "original_root_cause": row["original_root_cause"],
        "original_evidence": _safe_json_loads(row["original_evidence"], []),
        "original_recommended_fix": row["original_recommended_fix"],
        "original_next_command": row["original_next_command"],
        "original_osi_layer": row["original_osi_layer"],
        "original_confidence": row["original_confidence"],
        "batch_run_id": row["batch_run_id"],
    }


def insert_history_record(data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_connection()
    try:
        ts = datetime.now(timezone.utc).isoformat()
        ev_json = json.dumps(data.get("evidence", []))
        cur = conn.execute(
            """
            INSERT INTO history (
                case_id, case_title, osi_layer_expected, severity, is_custom,
                timestamp, evidence_used,
                problem, root_cause, evidence, recommended_fix, next_command, osi_layer, confidence,
                evaluation_status, evaluation_details, review_status,
                original_problem, original_root_cause, original_evidence, original_recommended_fix,
                original_next_command, original_osi_layer, original_confidence, batch_run_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNTESTED', NULL, 'Pending Review', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data["case_id"],
                data.get("case_title", ""),
                data.get("osi_layer_expected", ""),
                data.get("severity", "Medium"),
                1 if data.get("is_custom") else 0,
                ts,
                data["evidence_used"],
                data["problem"],
                data["root_cause"],
                ev_json,
                data["recommended_fix"],
                data["next_command"],
                data["osi_layer"],
                data["confidence"],
                data["problem"],
                data["root_cause"],
                ev_json,
                data["recommended_fix"],
                data["next_command"],
                data["osi_layer"],
                data["confidence"],
                data.get("batch_run_id"),
            ),
        )
        conn.commit()
        rec_id = cur.lastrowid
        row = conn.execute("SELECT * FROM history WHERE id = ?", (rec_id,)).fetchone()
        return _row_to_history(row)
    finally:
        conn.close()


def get_history_by_id(record_id: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM history WHERE id = ?", (record_id,)).fetchone()
        return _row_to_history(row) if row else None
    finally:
        conn.close()


def list_history(
    case_id: Optional[str] = None,
    evaluation_status: Optional[str] = None,
    review_status: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM history ORDER BY id DESC").fetchall()
        records = [_row_to_history(r) for r in rows]
        if case_id:
            records = [r for r in records if r["case_id"].lower() == case_id.lower()]
        if evaluation_status and evaluation_status != "ALL":
            records = [r for r in records if r["evaluation_status"] == evaluation_status]
        if review_status and review_status != "ALL":
            records = [r for r in records if r["review_status"] == review_status]
        if search and search.strip():
            q = search.strip().lower()
            records = [
                r
                for r in records
                if q in r["case_id"].lower()
                or q in r["problem"].lower()
                or q in r["root_cause"].lower()
                or q in r["recommended_fix"].lower()
            ]
        return records
    finally:
        conn.close()


def update_history_evaluation(record_id: int, status: str, details: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE history SET evaluation_status = ?, evaluation_details = ? WHERE id = ?",
            (status, json.dumps(details), record_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM history WHERE id = ?", (record_id,)).fetchone()
        if not row:
            raise ValueError(f"History record #{record_id} not found.")
        return _row_to_history(row)
    finally:
        conn.close()


def update_history_review(record_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    existing = get_history_by_id(record_id)
    if not existing:
        raise ValueError(f"History record #{record_id} not found.")

    action = payload["action"]
    reviewed_at = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    try:
        if action == "accept":
            conn.execute(
                "UPDATE history SET review_status = 'Accepted', review_reason = ?, reviewed_at = ? WHERE id = ?",
                (payload.get("reason") or "Expert verified AI diagnosis as accurate.", reviewed_at, record_id),
            )
        elif action == "reject":
            reason = (payload.get("reason") or "").strip()
            if not reason:
                raise ValueError("Rejection reason is required.")
            conn.execute(
                "UPDATE history SET review_status = 'Rejected', review_reason = ?, reviewed_at = ? WHERE id = ?",
                (reason, reviewed_at, record_id),
            )
        elif action == "edit":
            evidence_val = payload.get("evidence")
            ev_json = json.dumps(evidence_val if isinstance(evidence_val, list) else existing["evidence"])
            conn.execute(
                """
                UPDATE history
                SET problem = ?, root_cause = ?, evidence = ?, recommended_fix = ?,
                    next_command = ?, osi_layer = ?, confidence = ?,
                    review_status = 'Edited', review_reason = ?, reviewed_at = ?
                WHERE id = ?
                """,
                (
                    payload.get("problem") or existing["problem"],
                    payload.get("root_cause") or existing["root_cause"],
                    ev_json,
                    payload.get("recommended_fix") or existing["recommended_fix"],
                    payload.get("next_command") or existing["next_command"],
                    payload.get("osi_layer") or existing["osi_layer"],
                    payload.get("confidence") or existing["confidence"],
                    payload.get("reason") or "Updated by human network expert.",
                    reviewed_at,
                    record_id,
                ),
            )
        else:
            raise ValueError(f"Unsupported review action: {action}")
        conn.commit()
        row = conn.execute("SELECT * FROM history WHERE id = ?", (record_id,)).fetchone()
        return _row_to_history(row)
    finally:
        conn.close()


def save_batch_run(batch: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO batch_runs (
                id, timestamp, total_cases, passed_cases, failed_cases, untested_cases, accuracy, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                batch["id"],
                batch["timestamp"],
                batch["total_cases"],
                batch["passed_cases"],
                batch["failed_cases"],
                batch["untested_cases"],
                batch["accuracy"],
                batch["status"],
            ),
        )
        conn.commit()
        return batch
    finally:
        conn.close()


def list_batch_runs() -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM batch_runs ORDER BY timestamp DESC LIMIT 20").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
