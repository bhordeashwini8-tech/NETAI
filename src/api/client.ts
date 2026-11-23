import type {
  BatchRunRecord,
  DashboardStats,
  EvaluationDetails,
  HealthStatus,
  HistoryRecord,
  NetworkCase,
} from '../types';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    throw new ApiError(
      `Unable to reach the NetAI backend server. Ensure the backend is running (${err instanceof Error ? err.message : 'network error'}).`,
      0,
      'BACKEND_UNREACHABLE'
    );
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    if (!response.ok) {
      throw new ApiError(`Server error (${response.status}): ${response.statusText}`, response.status);
    }
  }

  if (!response.ok) {
    const msg = typeof data.error === 'string' ? data.error : `Request failed with status ${response.status}`;
    const code = typeof data.code === 'string' ? data.code : undefined;
    throw new ApiError(msg, response.status, code);
  }

  return data as unknown as T;
}

export const api = {
  getHealth: () => request<HealthStatus>('/api/health'),

  getCases: (params?: { search?: string; osi_layer?: string; severity?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.osi_layer && params.osi_layer !== 'ALL') qs.set('osi_layer', params.osi_layer);
    if (params?.severity && params.severity !== 'ALL') qs.set('severity', params.severity);
    const query = qs.toString();
    return request<{ cases: NetworkCase[]; total: number }>(`/api/cases${query ? `?${query}` : ''}`);
  },

  getCaseById: (caseId: string) => request<{ case: NetworkCase }>(`/api/cases/${encodeURIComponent(caseId)}`),

  diagnose: (payload: {
    case_id?: string;
    is_custom?: boolean;
    title?: string;
    symptom?: string;
    topology?: string;
    ip_info?: string;
    command_output?: string;
    additional_evidence?: string;
    severity?: string;
    concept?: string;
    osi_layer?: string;
    expected_behavior?: string;
    actual_behavior?: string;
    auto_evaluate?: boolean;
    batch_run_id?: string;
  }) =>
    request<{ record: HistoryRecord; diagnosis: Record<string, unknown> }>('/api/diagnose', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  evaluate: (payload: { history_id?: number; case_id?: string }) =>
    request<{ evaluation: EvaluationDetails; record: HistoryRecord | null }>('/api/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  review: (payload: {
    history_id: number;
    action: 'accept' | 'edit' | 'reject';
    reason?: string;
    problem?: string;
    root_cause?: string;
    evidence?: string[];
    recommended_fix?: string;
    next_command?: string;
    osi_layer?: string;
    confidence?: string;
  }) =>
    request<{ record: HistoryRecord }>('/api/review', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getHistory: (params?: {
    search?: string;
    evaluation_status?: string;
    review_status?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.evaluation_status && params.evaluation_status !== 'ALL') {
      qs.set('evaluation_status', params.evaluation_status);
    }
    if (params?.review_status && params.review_status !== 'ALL') {
      qs.set('review_status', params.review_status);
    }
    const query = qs.toString();
    return request<{ history: HistoryRecord[]; total: number }>(`/api/history${query ? `?${query}` : ''}`);
  },

  getStats: () => request<DashboardStats>('/api/stats'),

  getBatches: () => request<{ batches: BatchRunRecord[] }>('/api/batches'),

  saveBatch: (batch: BatchRunRecord) =>
    request<{ batch: BatchRunRecord }>('/api/batches', {
      method: 'POST',
      body: JSON.stringify(batch),
    }),
};
