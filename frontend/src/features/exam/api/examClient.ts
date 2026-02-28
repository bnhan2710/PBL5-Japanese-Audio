// Exam API Client – manual exam creation feature
import { apiFetch } from '@/lib/apiClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'API error');
  }
  return res.json();
}

// --------------- Types ---------------

export interface ExamPayload {
  title: string;
  description?: string;
  time_limit?: number;
  audio_id?: string;
}

export interface ExamResponse {
  exam_id: string;
  title: string;
  description?: string;
  time_limit?: number;
  current_step: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExamListResponse {
  exams: ExamResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AnswerPayload {
  question_id: string;
  content?: string;
  image_url?: string;
  is_correct: boolean;
  order_index?: number;
}

export interface AnswerResponse extends AnswerPayload {
  answer_id: string;
}

export interface QuestionPayload {
  exam_id: string;
  mondai_group?: string;
  question_number?: number;
  audio_clip_url?: string;
  question_text?: string;
  image_url?: string;
  explanation?: string;
  answers?: AnswerPayload[];
}

export interface QuestionResponse {
  question_id: string;
  exam_id: string;
  mondai_group?: string;
  question_number?: number;
  audio_clip_url?: string;
  question_text?: string;
  image_url?: string;
  explanation?: string;
  answers: AnswerResponse[];
}

export interface AudioUploadResponse {
  question_id: string;
  audio_clip_url: string;
  duration?: number;
  format?: string;
}

// --------------- API Methods ---------------

export const examClient = {
  // Exam CRUD
  createExam: (data: ExamPayload) =>
    apiFetch(`${API_BASE}/api/exams`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<ExamResponse>(r)),

  updateExam: (examId: string, data: Partial<ExamPayload> & { current_step?: number; is_published?: boolean }) =>
    apiFetch(`${API_BASE}/api/exams/${examId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<ExamResponse>(r)),

  getExam: (examId: string) =>
    apiFetch(`${API_BASE}/api/exams/${examId}`).then((r) => handleResponse<ExamResponse>(r)),

  deleteExam: (examId: string) =>
    apiFetch(`${API_BASE}/api/exams/${examId}`, { method: 'DELETE' }),

  listExams: () =>
    apiFetch(`${API_BASE}/api/exams`)
      .then((r) => handleResponse<ExamListResponse>(r)).then((data) => data.exams),

  createQuestion: (data: QuestionPayload) =>
    apiFetch(`${API_BASE}/api/questions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<QuestionResponse>(r)),

  updateQuestion: (questionId: string, data: Partial<QuestionPayload>) =>
    apiFetch(`${API_BASE}/api/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<QuestionResponse>(r)),

  deleteQuestion: (questionId: string) =>
    apiFetch(`${API_BASE}/api/questions/${questionId}`, { method: 'DELETE' }),

  getExamQuestions: (examId: string) =>
    apiFetch(`${API_BASE}/api/exams/${examId}/questions`).then((r) => handleResponse<QuestionResponse[]>(r)),

  // Audio upload (multipart)
  uploadQuestionAudio: (questionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`${API_BASE}/api/questions/${questionId}/audio`, {
      method: 'POST',
      body: formData,
    }).then((r) => handleResponse<AudioUploadResponse>(r));
  },

  // Answer CRUD
  createAnswer: (data: AnswerPayload) =>
    apiFetch(`${API_BASE}/api/answers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<AnswerResponse>(r)),

  updateAnswer: (answerId: string, data: Partial<AnswerPayload>) =>
    apiFetch(`${API_BASE}/api/answers/${answerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<AnswerResponse>(r)),

  deleteAnswer: (answerId: string) =>
    apiFetch(`${API_BASE}/api/answers/${answerId}`, { method: 'DELETE' }),
};

// --------------- AI Exam Generation Types ---------------

export interface AIQuestionOption {
  label: string;
  content: string;
  is_correct: boolean;
}

export interface AIQuestion {
  mondai_group: string;
  question_number: number;
  introduction?: string;
  script_text: string;
  question_text: string;
  audio_url?: string;
  answers: AIQuestionOption[];
}

export interface AITimestampQuestion {
  question_number: number;
  start_time: number;
  end_time: number;
  text?: string;
}

export interface AITimestampMondai {
  mondai_number: number;
  title: string;
  start_time: number;
  end_time: number;
  questions: AITimestampQuestion[];
}

export interface AIExamResult {
  raw_transcript: string;
  refined_script: string;
  timestamps?: AITimestampMondai[];
  questions: AIQuestion[];
}

export interface AIJobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  progress_message: string;
  result?: AIExamResult;
  error?: string;
}

// --------------- AI Exam API Methods ---------------

export const aiExamClient = {
  /**
   * Upload audio file and start AI exam generation pipeline.
   * Returns job_id for polling.
   */
  generateExamFromAudio: (
    file: File,
    jlpt_level: string = 'N2',
    title: string = '',
  ): Promise<AIJobStatus> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('jlpt_level', jlpt_level);
    formData.append('title', title);
    return apiFetch(`${API_BASE}/api/ai/generate-exam`, {
      method: 'POST',
      body: formData,
    }).then((r) => handleResponse<AIJobStatus>(r));
  },

  /** Poll job status. */
  getJobStatus: (jobId: string): Promise<AIJobStatus> =>
    apiFetch(`${API_BASE}/api/ai/job/${jobId}`)
      .then((r) => handleResponse<AIJobStatus>(r)),

  /** Cleanup job from server memory. */
  deleteJob: (jobId: string): Promise<void> =>
    apiFetch(`${API_BASE}/api/ai/job/${jobId}`, { method: 'DELETE' }).then(() => undefined),
};
