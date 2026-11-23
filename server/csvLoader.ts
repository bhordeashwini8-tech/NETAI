import fs from 'node:fs';
import path from 'node:path';

export interface NetworkCase {
  case_id: string;
  title: string;
  symptom: string;
  topology: string;
  ip_info: string;
  command_output: string;
  expected_behavior: string;
  actual_behavior: string;
  expected_fault: string;
  osi_layer: string;
  concept: string;
  severity: string;
  expected_next_command: string;
  expected_fix: string;
}

/**
 * RFC-4180 compliant CSV parser handling multi-line quoted fields and escaped quotes ("").
 */
export function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0].trim() === '') continue;
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = (row[c] ?? '').trim();
    }
    if (record.case_id) {
      records.push(record);
    }
  }

  return records;
}

export function getCasesFilePath(): string {
  return path.resolve(process.cwd(), 'data', 'cases.csv');
}

export function loadCases(): NetworkCase[] {
  const csvPath = getCasesFilePath();
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Dataset file not found at ${csvPath}. Ensure data/cases.csv exists.`);
  }

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const parsed = parseCsv(raw);

  if (parsed.length === 0) {
    throw new Error(`Dataset file ${csvPath} is empty or contains invalid CSV formatting.`);
  }

  return parsed.map((row) => ({
    case_id: row.case_id || '',
    title: row.title || '',
    symptom: row.symptom || '',
    topology: row.topology || '',
    ip_info: row.ip_info || '',
    command_output: row.command_output || '',
    expected_behavior: row.expected_behavior || '',
    actual_behavior: row.actual_behavior || '',
    expected_fault: row.expected_fault || '',
    osi_layer: row.osi_layer || '',
    concept: row.concept || '',
    severity: row.severity || '',
    expected_next_command: row.expected_next_command || '',
    expected_fix: row.expected_fix || '',
  }));
}

export function getCaseById(caseId: string): NetworkCase | undefined {
  const cases = loadCases();
  return cases.find((c) => c.case_id.toUpperCase() === caseId.toUpperCase());
}
