import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getCaseById, loadCases } from './server/csvLoader.ts';
import {
  computeDashboardStats,
  getHistoryById,
  initDatabase,
  insertHistoryRecord,
  listBatchRuns,
  listHistory,
  saveBatchRun,
  updateHistoryEvaluation,
  updateHistoryReview,
} from './server/database.ts';
import { evaluateDiagnosis } from './server/evaluator.ts';
import { GeminiServiceError, runNetworkDiagnosis } from './server/geminiService.ts';

const PORT = Number(process.env.PORT) || 3000;

async function createServer() {
  // Initialize SQLite database automatically on backend startup
  initDatabase();

  const app = express();

  app.use(express.json({ limit: '2mb' }));

  // CORS support for local frontend development
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // GET /api/health
  app.get('/api/health', (_req: Request, res: Response) => {
    try {
      initDatabase();
      const cases = loadCases();
      const keyConfigured = Boolean(
        process.env.GEMINI_API_KEY &&
          process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
          process.env.GEMINI_API_KEY.trim().length > 0
      );
      res.json({
        status: 'ok',
        database: 'connected',
        dataset_loaded: true,
        cases_count: cases.length,
        ai_configured: keyConfigured,
        model: 'gemini-4-hydrogen',
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        status: 'error',
        error: err instanceof Error ? err.message : 'Health check failed',
      });
    }
  });

  // GET /api/cases
  app.get('/api/cases', (req: Request, res: Response) => {
    try {
      let cases = loadCases();
      const search = String(req.query.search || '').trim().toLowerCase();
      const osiLayer = String(req.query.osi_layer || '').trim().toLowerCase();
      const severity = String(req.query.severity || '').trim().toLowerCase();

      if (osiLayer && osiLayer !== 'all') {
        cases = cases.filter((c) => c.osi_layer.toLowerCase().includes(osiLayer));
      }
      if (severity && severity !== 'all') {
        cases = cases.filter((c) => c.severity.toLowerCase() === severity);
      }
      if (search) {
        cases = cases.filter(
          (c) =>
            c.case_id.toLowerCase().includes(search) ||
            c.title.toLowerCase().includes(search) ||
            c.symptom.toLowerCase().includes(search) ||
            c.concept.toLowerCase().includes(search) ||
            c.ip_info.toLowerCase().includes(search) ||
            c.command_output.toLowerCase().includes(search)
        );
      }

      res.json({ cases, total: cases.length });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load network troubleshooting dataset.',
      });
    }
  });

  // GET /api/cases/:case_id
  app.get('/api/cases/:case_id', (req: Request, res: Response) => {
    try {
      const found = getCaseById(String(req.params.case_id));
      if (!found) {
        res.status(404).json({ error: `Case "${req.params.case_id}" not found.` });
        return;
      }
      res.json({ case: found });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to retrieve case details.',
      });
    }
  });

  // POST /api/diagnose
  app.post('/api/diagnose', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const isCustom = Boolean(body.is_custom);
      const autoEvaluate = Boolean(body.auto_evaluate);
      const batchRunId = body.batch_run_id ? String(body.batch_run_id) : null;

      let caseId = String(body.case_id || '').trim();
      let title = String(body.title || '').trim();
      let symptom = String(body.symptom || '').trim();
      let topology = String(body.topology || '').trim();
      let ipInfo = String(body.ip_info || '').trim();
      let commandOutput = String(body.command_output || '').trim();
      let additionalEvidence = String(body.additional_evidence || '').trim();
      let severity = String(body.severity || 'Medium').trim();
      let conceptHint = String(body.concept || '').trim();
      let osiLayerHint = String(body.osi_layer || '').trim();
      let expectedBehavior = String(body.expected_behavior || '').trim();
      let actualBehavior = String(body.actual_behavior || '').trim();

      let matchedCase = !isCustom && caseId ? getCaseById(caseId) : undefined;

      if (!isCustom) {
        if (!caseId) {
          res.status(400).json({ error: 'case_id is required when diagnosing a predefined case.' });
          return;
        }
        if (!matchedCase) {
          res.status(404).json({ error: `Predefined case "${caseId}" not found in dataset.` });
          return;
        }
        // Allow user-edited evidence from the Evidence Editor while falling back to CSV fields
        title = title || matchedCase.title;
        symptom = symptom || matchedCase.symptom;
        topology = topology || matchedCase.topology;
        ipInfo = ipInfo || matchedCase.ip_info;
        commandOutput = commandOutput || matchedCase.command_output;
        expectedBehavior = expectedBehavior || matchedCase.expected_behavior;
        actualBehavior = actualBehavior || matchedCase.actual_behavior;
        severity = matchedCase.severity;
        conceptHint = matchedCase.concept;
        osiLayerHint = matchedCase.osi_layer;
      } else {
        // Custom case validation
        if (!symptom || !commandOutput) {
          res.status(400).json({
            error: 'Both symptom/problem description and show command output are required for custom diagnosis.',
          });
          return;
        }
        if (!caseId) {
          const now = new Date();
          const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
          const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
          caseId = `CUSTOM-${datePart}-${randPart}`;
        }
        title = title || `Custom Diagnosis (${caseId})`;
      }

      const aiResult = await runNetworkDiagnosis({
        case_id: caseId,
        title,
        symptom,
        topology,
        ip_info: ipInfo,
        command_output: commandOutput,
        expected_behavior: expectedBehavior,
        actual_behavior: actualBehavior,
        osi_layer_hint: isCustom ? osiLayerHint : undefined,
        concept_hint: isCustom ? conceptHint : undefined,
        severity,
        additional_evidence: additionalEvidence,
      });

      const evidenceUsedSnapshot = JSON.stringify({
        topology,
        ip_info: ipInfo,
        command_output: commandOutput,
        additional_evidence: additionalEvidence,
        symptom,
      });

      let record = insertHistoryRecord({
        case_id: caseId,
        case_title: title,
        osi_layer_expected: matchedCase?.osi_layer || osiLayerHint || aiResult.osi_layer,
        severity,
        is_custom: isCustom,
        evidence_used: evidenceUsedSnapshot,
        problem: aiResult.problem,
        root_cause: aiResult.root_cause,
        evidence: aiResult.evidence,
        recommended_fix: aiResult.recommended_fix,
        next_command: aiResult.next_command,
        osi_layer: aiResult.osi_layer,
        confidence: aiResult.confidence,
        batch_run_id: batchRunId,
      });

      if (autoEvaluate && matchedCase) {
        const evalDetails = evaluateDiagnosis(aiResult, matchedCase);
        record = updateHistoryEvaluation(record.id, evalDetails.verdict, evalDetails);
      }

      res.json({
        record,
        diagnosis: aiResult,
      });
    } catch (err: unknown) {
      if (err instanceof GeminiServiceError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unexpected diagnosis error.',
      });
    }
  });

  // POST /api/evaluate
  app.post('/api/evaluate', (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const historyId = body.history_id !== undefined ? Number(body.history_id) : undefined;

      let caseId = String(body.case_id || '').trim();
      let diagnosisCandidate = {
        problem: String(body.problem || ''),
        root_cause: String(body.root_cause || ''),
        confidence: String(body.confidence || ''),
        osi_layer: String(body.osi_layer || ''),
        evidence: Array.isArray(body.evidence) ? body.evidence.map(String) : [],
        recommended_fix: String(body.recommended_fix || ''),
        next_command: String(body.next_command || ''),
      };

      let existingRecord = historyId ? getHistoryById(historyId) : null;
      if (historyId && !existingRecord) {
        res.status(404).json({ error: `History record #${historyId} not found.` });
        return;
      }

      if (existingRecord) {
        caseId = caseId || existingRecord.case_id;
        diagnosisCandidate = {
          problem: existingRecord.problem,
          root_cause: existingRecord.root_cause,
          confidence: existingRecord.confidence,
          osi_layer: existingRecord.osi_layer,
          evidence: existingRecord.evidence,
          recommended_fix: existingRecord.recommended_fix,
          next_command: existingRecord.next_command,
        };
      }

      if (!caseId) {
        res.status(400).json({ error: 'case_id or history_id is required for evaluation.' });
        return;
      }

      const refCase = getCaseById(caseId);
      if (!refCase) {
        res.status(404).json({
          error: `No ground-truth reference case found for "${caseId}". Evaluation is available for predefined dataset cases (CASE-001 to CASE-030).`,
        });
        return;
      }

      const evaluation = evaluateDiagnosis(diagnosisCandidate, refCase);

      if (existingRecord) {
        existingRecord = updateHistoryEvaluation(existingRecord.id, evaluation.verdict, evaluation);
      }

      res.json({
        evaluation,
        record: existingRecord,
      });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Evaluation failed.',
      });
    }
  });

  // POST /api/review
  app.post('/api/review', (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const historyId = Number(body.history_id);
      const action = String(body.action || '').toLowerCase() as 'accept' | 'edit' | 'reject';

      if (!historyId || Number.isNaN(historyId)) {
        res.status(400).json({ error: 'Valid history_id is required.' });
        return;
      }
      if (!['accept', 'edit', 'reject'].includes(action)) {
        res.status(400).json({ error: 'action must be one of: accept, edit, reject.' });
        return;
      }
      if (action === 'reject' && (!body.reason || !String(body.reason).trim())) {
        res.status(400).json({ error: 'A rejection reason is required when rejecting a diagnosis.' });
        return;
      }

      const updated = updateHistoryReview(historyId, {
        action,
        reason: body.reason ? String(body.reason) : undefined,
        problem: body.problem !== undefined ? String(body.problem) : undefined,
        root_cause: body.root_cause !== undefined ? String(body.root_cause) : undefined,
        evidence: Array.isArray(body.evidence) ? body.evidence.map(String) : undefined,
        recommended_fix: body.recommended_fix !== undefined ? String(body.recommended_fix) : undefined,
        next_command: body.next_command !== undefined ? String(body.next_command) : undefined,
        osi_layer: body.osi_layer !== undefined ? String(body.osi_layer) : undefined,
        confidence: body.confidence !== undefined ? String(body.confidence) : undefined,
      });

      res.json({ record: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Review update failed.';
      const status = msg.includes('not found') ? 404 : 400;
      res.status(status).json({ error: msg });
    }
  });

  // GET /api/history
  app.get('/api/history', (req: Request, res: Response) => {
    try {
      const records = listHistory({
        case_id: req.query.case_id ? String(req.query.case_id) : undefined,
        evaluation_status: req.query.evaluation_status ? String(req.query.evaluation_status) : undefined,
        review_status: req.query.review_status ? String(req.query.review_status) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json({ history: records, total: records.length });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch history from database.',
      });
    }
  });

  // GET /api/history/:id
  app.get('/api/history/:id', (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const record = getHistoryById(id);
      if (!record) {
        res.status(404).json({ error: `History record #${req.params.id} not found.` });
        return;
      }
      res.json({ record });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to retrieve history record.',
      });
    }
  });

  // GET /api/stats
  app.get('/api/stats', (_req: Request, res: Response) => {
    try {
      const stats = computeDashboardStats();
      res.json(stats);
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to compute dashboard statistics.',
      });
    }
  });

  // GET /api/batches & POST /api/batches
  app.get('/api/batches', (_req: Request, res: Response) => {
    try {
      res.json({ batches: listBatchRuns() });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list batch runs.' });
    }
  });

  app.post('/api/batches', (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      const saved = saveBatchRun({
        id: String(b.id || `BATCH-${Date.now()}`),
        timestamp: String(b.timestamp || new Date().toISOString()),
        total_cases: Number(b.total_cases || 0),
        passed_cases: Number(b.passed_cases || 0),
        failed_cases: Number(b.failed_cases || 0),
        untested_cases: Number(b.untested_cases || 0),
        accuracy: Number(b.accuracy || 0),
        status: String(b.status || 'Completed'),
      });
      res.json({ batch: saved });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save batch summary.' });
    }
  });

  // Mount Vite middleware in dev or serve dist/ in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Frontend build not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NetAI server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start NetAI server:', err);
  process.exit(1);
});
