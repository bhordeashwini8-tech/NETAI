import { GoogleGenAI, Type } from '@google/genai';

export interface DiagnosisInput {
  case_id: string;
  title: string;
  symptom: string;
  topology: string;
  ip_info: string;
  command_output: string;
  expected_behavior?: string;
  actual_behavior?: string;
  osi_layer_hint?: string;
  concept_hint?: string;
  severity?: string;
  additional_evidence?: string;
}

export interface DiagnosisOutput {
  problem: string;
  root_cause: string;
  confidence: string;
  osi_layer: string;
  evidence: string[];
  recommended_fix: string;
  next_command: string;
}

const SYSTEM_INSTRUCTION = `You are NetAI, a senior CCIE-level enterprise network troubleshooting and Cisco IOS fault diagnosis engine.
Analyze the provided networking case evidence strictly and accurately.

CRITICAL GROUNDING RULES:
1. NEVER invent, fabricate, or hallucinate IP addresses, subnet masks, interfaces, VLAN IDs, MAC addresses, AS numbers, ACL names, device hostnames, or command outputs that are not present in the provided case evidence.
2. Every item in "evidence" must quote or directly cite observed lines/values from the supplied command_output, ip_info, topology, or symptom.
3. "osi_layer" must clearly specify the primary OSI layer of the root cause (e.g., "Layer 1 (Physical)", "Layer 2 (Data Link)", "Layer 3 (Network)", "Layer 4 (Transport)", "Layer 5 (Session)", "Layer 6 (Presentation)", "Layer 7 (Application)").
4. "confidence" must be a realistic percentage string such as "95%" or "88%" reflecting how conclusively the provided evidence proves the root cause.
5. "recommended_fix" must provide exact, actionable remediation steps referencing only actual devices, interfaces, and parameters from the evidence.
6. "next_command" must be a single concrete Cisco IOS / Packet Tracer / host diagnostic command to verify the fault or confirm remediation.
7. Return valid JSON matching the required schema only.`;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || !apiKey.trim()) {
    throw new GeminiServiceError(
      'GEMINI_API_KEY is not configured. Set your Gemini API key in the AI Studio Secrets panel.',
      503,
      'MISSING_API_KEY'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export class GeminiServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = 'GEMINI_ERROR') {
    super(message);
    this.name = 'GeminiServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runNetworkDiagnosis(input: DiagnosisInput): Promise<DiagnosisOutput> {
  const ai = getClient();

  const prompt = [
    `Case ID: ${input.case_id}`,
    `Title: ${input.title}`,
    `Severity: ${input.severity || 'Not specified'}`,
    input.concept_hint ? `Networking Concept Hint: ${input.concept_hint}` : '',
    input.osi_layer_hint ? `Reported OSI Layer Hint: ${input.osi_layer_hint}` : '',
    `Symptom / Problem Description:\n${input.symptom}`,
    `Network Topology:\n${input.topology || 'Not provided'}`,
    `IP Addressing Information:\n${input.ip_info || 'Not provided'}`,
    input.expected_behavior ? `Expected Behavior:\n${input.expected_behavior}` : '',
    input.actual_behavior ? `Actual Behavior:\n${input.actual_behavior}` : '',
    `CLI / Command Output Evidence:\n${input.command_output}`,
    input.additional_evidence ? `Additional Configuration / Notes:\n${input.additional_evidence}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              problem: {
                type: Type.STRING,
                description: 'Concise summary of the observed networking problem grounded in the evidence.',
              },
              root_cause: {
                type: Type.STRING,
                description: 'The exact underlying technical root cause identified strictly from the provided evidence.',
              },
              confidence: {
                type: Type.STRING,
                description: 'Confidence percentage string, e.g. "94%".',
              },
              osi_layer: {
                type: Type.STRING,
                description: 'Primary OSI layer where the fault occurs, e.g. "Layer 3 (Network)".',
              },
              evidence: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Direct supporting evidence quotes/observations extracted from the supplied CLI output and topology.',
              },
              recommended_fix: {
                type: Type.STRING,
                description: 'Exact remediation commands/steps referencing only observed interfaces and IPs.',
              },
              next_command: {
                type: Type.STRING,
                description: 'Recommended next troubleshooting or verification CLI command.',
              },
            },
            required: [
              'problem',
              'root_cause',
              'confidence',
              'osi_layer',
              'evidence',
              'recommended_fix',
              'next_command',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new GeminiServiceError(
          'Gemini returned an empty response for this diagnosis request.',
          502,
          'EMPTY_AI_RESPONSE'
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new GeminiServiceError(
          'Gemini returned malformed JSON that could not be parsed.',
          502,
          'INVALID_AI_JSON'
        );
      }

      const obj = parsed as Record<string, unknown>;
      const output: DiagnosisOutput = {
        problem: String(obj.problem || '').trim(),
        root_cause: String(obj.root_cause || '').trim(),
        confidence: String(obj.confidence || '85%').trim(),
        osi_layer: String(obj.osi_layer || '').trim(),
        evidence: Array.isArray(obj.evidence)
          ? obj.evidence.map((e) => String(e).trim()).filter(Boolean)
          : [],
        recommended_fix: String(obj.recommended_fix || '').trim(),
        next_command: String(obj.next_command || '').trim(),
      };

      if (!output.problem || !output.root_cause || !output.recommended_fix) {
        throw new GeminiServiceError(
          'Gemini response omitted required diagnosis fields (problem, root_cause, or recommended_fix).',
          502,
          'INCOMPLETE_AI_RESPONSE'
        );
      }

      return output;
    } catch (err: unknown) {
      lastError = err;
      if (err instanceof GeminiServiceError && err.code === 'MISSING_API_KEY') {
        throw err;
      }

      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
      const isTransient = isRateLimit || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('ECONNRESET');

      if (isTransient && attempt < maxAttempts) {
        await sleep(800 * Math.pow(2, attempt - 1));
        continue;
      }

      if (isRateLimit) {
        throw new GeminiServiceError(
          'Gemini API rate limit or quota exceeded (429 RESOURCE_EXHAUSTED). Wait briefly and retry, or check your API quota.',
          429,
          'RATE_LIMIT'
        );
      }
      if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('401')) {
        throw new GeminiServiceError(
          'Gemini API key was rejected (invalid or lacks permission). Check your GEMINI_API_KEY in Settings > Secrets.',
          403,
          'INVALID_API_KEY'
        );
      }
      if (err instanceof GeminiServiceError) {
        throw err;
      }
      throw new GeminiServiceError(`Gemini API diagnosis failed: ${msg}`, 502, 'GEMINI_UPSTREAM_ERROR');
    }
  }

  throw new GeminiServiceError(
    `Gemini API diagnosis failed after retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    502,
    'GEMINI_RETRY_EXHAUSTED'
  );
}
