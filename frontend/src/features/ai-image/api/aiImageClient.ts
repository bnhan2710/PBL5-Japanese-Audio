import { apiFetch } from '@/lib/apiClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'API error');
  }
  return res.json();
}

export interface AIImageTaskRequest {
  question_id: string;
  script_text: string;
  question_text: string;
  jlpt_level: string;
  mode?: 'quad' | 'single';
}

export interface ImageResultData {
  question_id: string;
  image_url: string;
  prompts_used: string[];
}

export interface AIImageJobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  progress_message: string;
  result?: ImageResultData;
  error?: string;
}

export interface AIImageResponse {
  job_id: string;
  status: string;
}

export const aiImageClient = {
  generateImage: (data: AIImageTaskRequest) =>
    apiFetch(`${API_BASE}/api/ai-image/generate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<AIImageResponse>(r)),

  getJobStatus: (jobId: string) =>
    apiFetch(`${API_BASE}/api/ai-image/job/${jobId}`)
      .then((r) => handleResponse<AIImageJobStatus>(r)),
};
