# NetAI — Intelligent AI-Based Network Troubleshooting & Fault Diagnosis System

NetAI is a full-stack AI-powered enterprise network troubleshooting platform designed for Cisco IOS and Packet Tracer environments. It analyzes CLI evidence with Google Gemini 2.5 Flash, evaluates diagnosis accuracy against ground-truth cases, supports human expert review workflows, and persists all metrics in SQLite (`data/netsage.db`).

## Key Features
- **Dynamic Dashboard**: Live KPIs (Total, Passed, Failed, Untested runs, Overall Accuracy), Human Review stats, OSI Layer-wise & Severity-wise accuracy, and recent activity loaded from SQLite.
- **30 Predefined Network Cases (`data/cases.csv`)**: Layer 1–7 Cisco troubleshooting scenarios with search, OSI/Severity filters, interactive topology schematics, and a live Evidence Editor.
- **Custom Network Diagnosis**: Submit live CLI captures (`show ip interface brief`, `show running-config`, `show ip route`, `show vlan brief`, `show interfaces trunk`, `show access-lists`, `show arp`, `show ip ospf neighbor`, `ipconfig`, `ping`) with unique `CUSTOM-*` tracking IDs.
- **Diagnosis Evaluation Engine (`POST /api/evaluate`)**: Multi-factor rule check verifying root cause, remediation commands, networking keywords, configuration grounding, and OSI layer (`PASS` / `FAIL`).
- **Human Expert Review (`POST /api/review`)**: Accept, Edit (preserving original AI results for comparison), or Reject (with required reason) stored in SQLite.
- **Batch Testing & History Audit**: Run multi-case AI diagnosis + automated evaluation batches and inspect every historical record.

## Quick Start (Full-Stack Node + Vite Runtime — Port 3000)
```bash
npm install
cp .env.example .env   # Add your GEMINI_API_KEY
npm run dev
```
Open `http://localhost:3000`.

## Running with Python FastAPI Backend on Windows (Ports 8000 & 5173)

### 1. Start the Python FastAPI Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
set GEMINI_API_KEY=your_api_key_here
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Configure Frontend Proxy / Start Vite on Port 5173
If running Vite standalone against the FastAPI backend on `http://127.0.0.1:8000`, proxy `/api` in `vite.config.ts` to `http://127.0.0.1:8000` and run:
```powershell
npx vite --port 5173
```

## API Endpoints
- `GET /api/health` — Backend, SQLite, dataset, and Gemini configuration check
- `GET /api/cases` — List and filter all 30 cases from `data/cases.csv`
- `GET /api/cases/{case_id}` — Fetch single case details
- `POST /api/diagnose` — Run grounded Gemini 2.5 Flash diagnosis and save to SQLite
- `POST /api/evaluate` — Evaluate diagnosis against expected solution
- `POST /api/review` — Accept, edit, or reject diagnosis as a human network expert
- `GET /api/history` — Retrieve saved diagnosis history from SQLite
- `GET /api/stats` — Compute dynamic dashboard KPIs and breakdowns
