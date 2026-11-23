import type { NetworkCase } from './csvLoader.ts';
import type { EvaluationCheck, EvaluationDetails } from './database.ts';

export interface DiagnosisCandidate {
  problem: string;
  root_cause: string;
  confidence: string;
  osi_layer: string;
  evidence: string[];
  recommended_fix: string;
  next_command: string;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'onto', 'over',
  'under', 'between', 'across', 'when', 'where', 'which', 'while', 'both', 'each',
  'only', 'must', 'should', 'could', 'would', 'cannot', 'failed', 'failing', 'fails',
  'using', 'configured', 'configure', 'interface', 'interfaces', 'network', 'router',
  'switch', 'device', 'packet', 'traffic', 'system', 'cause', 'causing', 'because',
  'being', 'been', 'have', 'has', 'are', 'was', 'were', 'not', 'but', 'all', 'any',
  'due', 'instead', 'mode', 'state', 'link', 'line', 'port', 'ports', 'enter',
  'execute', 'command', 'verify', 'update', 'change', 'add', 'set', 'use', 'match',
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/gigabitethernet/g, 'gi')
    .replace(/fastethernet/g, 'fa')
    .replace(/tengigabitethernet/g, 'te')
    .replace(/port-channel/g, 'po')
    .replace(/[^a-z0-9./:_-]+/g, ' ')
    .trim();
}

function extractKeywords(text: string): string[] {
  const norm = normalizeText(text);
  const tokens = norm.split(/\s+/).filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  return Array.from(new Set(tokens));
}

function extractTechnicalTokens(text: string): string[] {
  const matches = new Set<string>();
  const ipRegex = /\b\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?\b/g;
  const ifRegex = /\b(?:gi|gigabitethernet|fa|fastethernet|te|tengigabitethernet|vlan|tunnel|po|loopback)\s*\d+(?:\/\d+)*(?:\.\d+)?\b/gi;
  const numTerms = /\b(?:vlan\s*\d+|area\s*\d+|as\s*\d+|remote-as\s*\d+|group\s*\d+|standby\s*\d+|eq\s*\d+|port\s*\d+|mtu\s*\d+|dot1q\s*\d+|priority\s*\d+|acl\s*\w+)\b/gi;

  for (const m of text.match(ipRegex) || []) matches.add(m.toLowerCase());
  for (const m of text.match(ifRegex) || []) matches.add(normalizeText(m).replace(/\s+/g, ''));
  for (const m of text.match(numTerms) || []) matches.add(normalizeText(m));

  return Array.from(matches);
}

function extractLayerNumber(layerStr: string): string | null {
  const m = layerStr.match(/(?:layer\s*)?([1-7])/i);
  if (m) return m[1];
  const lower = layerStr.toLowerCase();
  if (lower.includes('physical')) return '1';
  if (lower.includes('data link') || lower.includes('datalink')) return '2';
  if (lower.includes('network')) return '3';
  if (lower.includes('transport')) return '4';
  if (lower.includes('session')) return '5';
  if (lower.includes('presentation')) return '6';
  if (lower.includes('application')) return '7';
  return null;
}

export function evaluateDiagnosis(
  diagnosis: DiagnosisCandidate,
  referenceCase: NetworkCase
): EvaluationDetails {
  const checks: EvaluationCheck[] = [];

  const diagCauseText = normalizeText(`${diagnosis.problem} ${diagnosis.root_cause}`);
  const diagFixText = normalizeText(`${diagnosis.recommended_fix} ${diagnosis.next_command}`);
  const diagAllText = normalizeText(
    `${diagnosis.problem} ${diagnosis.root_cause} ${diagnosis.evidence.join(' ')} ${diagnosis.recommended_fix} ${diagnosis.next_command}`
  );

  // 1. Root Cause Identification Check
  const faultKeywords = extractKeywords(referenceCase.expected_fault);
  const matchedFaultKeywords = faultKeywords.filter((kw) => diagCauseText.includes(kw));
  const faultRatio = faultKeywords.length > 0 ? matchedFaultKeywords.length / faultKeywords.length : 1;
  const rootCausePassed = faultRatio >= 0.35 || matchedFaultKeywords.length >= 2;
  checks.push({
    name: 'Root Cause Identification',
    passed: rootCausePassed,
    score: Math.round(Math.min(1, faultRatio * 1.5) * 100),
    detail: rootCausePassed
      ? `Matched ${matchedFaultKeywords.length}/${faultKeywords.length} root-cause indicators (${matchedFaultKeywords.slice(0, 5).join(', ')}).`
      : `Insufficient root-cause alignment with expected fault ("${referenceCase.expected_fault}"). Matched only: ${matchedFaultKeywords.join(', ') || 'none'}.`,
  });

  // 2. Recommended Fix Correctness Check
  const fixKeywords = extractKeywords(referenceCase.expected_fix);
  const matchedFixKeywords = fixKeywords.filter((kw) => diagFixText.includes(kw));
  const fixRatio = fixKeywords.length > 0 ? matchedFixKeywords.length / fixKeywords.length : 1;
  const fixPassed = fixRatio >= 0.3 || matchedFixKeywords.length >= 2;
  checks.push({
    name: 'Recommended Fix Correctness',
    passed: fixPassed,
    score: Math.round(Math.min(1, fixRatio * 1.6) * 100),
    detail: fixPassed
      ? `Remediation captures key corrective actions (${matchedFixKeywords.slice(0, 5).join(', ')}).`
      : `Recommended fix misses required corrective actions from expected fix ("${referenceCase.expected_fix}").`,
  });

  // 3. Networking Keywords & Concept Check
  const conceptKeywords = extractKeywords(`${referenceCase.concept} ${referenceCase.title}`);
  const matchedConceptKeywords = conceptKeywords.filter((kw) => diagAllText.includes(kw));
  const conceptRatio = conceptKeywords.length > 0 ? matchedConceptKeywords.length / conceptKeywords.length : 1;
  const keywordsPassed = conceptRatio >= 0.3 || matchedConceptKeywords.length >= 2;
  checks.push({
    name: 'Networking Keywords & Protocol Accuracy',
    passed: keywordsPassed,
    score: Math.round(Math.min(1, conceptRatio * 1.5) * 100),
    detail: keywordsPassed
      ? `Accurately identifies domain concepts: ${matchedConceptKeywords.slice(0, 6).join(', ')}.`
      : `Missing core networking protocol/concept terminology (${conceptKeywords.slice(0, 5).join(', ')}).`,
  });

  // 4. Configuration Details & Evidence Grounding Check
  const expectedTechTokens = extractTechnicalTokens(
    `${referenceCase.expected_fault} ${referenceCase.expected_fix} ${referenceCase.ip_info}`
  );
  const normDiagAllNoSpaces = diagAllText.replace(/\s+/g, '');
  const matchedTech = expectedTechTokens.filter(
    (tok) => diagAllText.includes(tok) || normDiagAllNoSpaces.includes(tok.replace(/\s+/g, ''))
  );
  const techRatio = expectedTechTokens.length > 0 ? matchedTech.length / expectedTechTokens.length : 1;
  const configPassed = expectedTechTokens.length === 0 || matchedTech.length >= 1;
  checks.push({
    name: 'Configuration Details & Topology Grounding',
    passed: configPassed,
    score: Math.round(Math.min(1, expectedTechTokens.length > 0 ? Math.max(techRatio, matchedTech.length > 0 ? 0.8 : 0) : 1) * 100),
    detail:
      expectedTechTokens.length === 0
        ? 'No strict IP/interface tokens required; diagnosis references case evidence.'
        : configPassed
          ? `Grounded in actual case entities: ${matchedTech.slice(0, 5).join(', ')}.`
          : `Expected configuration identifiers (${expectedTechTokens.slice(0, 4).join(', ')}) were not referenced.`,
  });

  // 5. OSI Layer Classification Check
  const expectedLayerNum = extractLayerNumber(referenceCase.osi_layer);
  const actualLayerNum = extractLayerNumber(diagnosis.osi_layer);
  const osiPassed = expectedLayerNum !== null && actualLayerNum === expectedLayerNum;
  checks.push({
    name: 'OSI Layer Classification',
    passed: osiPassed,
    score: osiPassed ? 100 : 0,
    detail: osiPassed
      ? `Correctly classified at ${referenceCase.osi_layer} (model output: "${diagnosis.osi_layer}").`
      : `Expected ${referenceCase.osi_layer}, but diagnosis classified as "${diagnosis.osi_layer || 'Unspecified'}".`,
  });

  const passedChecks = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;
  const overallScore = Math.round(checks.reduce((acc, c) => acc + c.score, 0) / totalChecks);

  // PASS if Root Cause + Fix pass and at least 4/5 checks pass (or >= 70% overall with core checks passing)
  const verdict: 'PASS' | 'FAIL' =
    rootCausePassed && fixPassed && passedChecks >= 4 ? 'PASS' : 'FAIL';

  const summary =
    verdict === 'PASS'
      ? `PASS – Diagnosis meets evaluation rules (${passedChecks}/${totalChecks} checks passed, ${overallScore}% match).`
      : `FAIL – Diagnosis does not meet evaluation rules (${passedChecks}/${totalChecks} checks passed, ${overallScore}% match).`;

  return {
    verdict,
    overall_score: overallScore,
    passed_checks: passedChecks,
    total_checks: totalChecks,
    checks,
    summary,
  };
}
