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
