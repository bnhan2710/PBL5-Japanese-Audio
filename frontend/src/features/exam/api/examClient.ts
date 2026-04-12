// Exam API Client – manual exam creation feature
import { apiFetch } from '@/lib/apiClient'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    let message: string
    if (typeof err?.detail === 'string') {
      message = err.detail
    } else if (Array.isArray(err?.detail)) {
      message = err.detail
        .map((item: any) => (typeof item === 'string' ? item : item?.msg || JSON.stringify(item)))
        .join('; ')
    } else if (err?.detail && typeof err.detail === 'object') {
      message = err.detail.msg || JSON.stringify(err.detail)
    } else if (typeof err?.message === 'string') {
      message = err.message
    } else {
      message = res.statusText || 'API error'
    }
    throw new Error(message)
  }
  return res.json()
}

// --------------- Types ---------------

export interface ExamPayload {
  title: string
  description?: string
  audio_mode?: 'practice' | 'simulation'
  time_limit?: number
  audio_id?: string
}

export interface ExamResponse {
  exam_id: string
  title: string
  description?: string
  audio_mode?: 'practice' | 'simulation'
  audio_id?: string
  audio_file_url?: string | null
  audio_file_name?: string | null
  time_limit?: number
  current_step: number
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface ExamListResponse {
  exams: ExamResponse[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface AnswerPayload {
  question_id: string
  content?: string
  image_url?: string | null
  is_correct: boolean
  order_index?: number
}

export interface AnswerResponse extends AnswerPayload {
  answer_id: string
}

export interface QuestionPayload {
  exam_id: string
  mondai_group?: string
  question_number?: number
  audio_clip_url?: string
  question_text?: string
  image_url?: string | null
  script_text?: string
  explanation?: string
  raw_transcript?: string
  hide_question_text?: boolean
  difficulty?: number
  answers?: AnswerPayload[]
}

export interface QuestionResponse {
  question_id: string
  exam_id: string
  mondai_group?: string
  question_number?: number
  audio_clip_url?: string
  question_text?: string
  image_url?: string | null
  script_text?: string
  explanation?: string
  raw_transcript?: string
  hide_question_text?: boolean
  difficulty?: number
  answers: AnswerResponse[]
}

export interface AudioUploadResponse {
  question_id: string
  audio_clip_url: string
  duration?: number
  format?: string
}

export interface ImageUploadResponse {
  question_id: string
  image_url: string
}

// --------------- API Methods ---------------

export const examClient = {
  // Exam CRUD
  createExam: (data: ExamPayload) =>
    apiFetch(`${API_BASE}/api/exams`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<ExamResponse>(r)),

  updateExam: (
    examId: string,
    data: Partial<ExamPayload> & { current_step?: number; is_published?: boolean }
  ) =>
    apiFetch(`${API_BASE}/api/exams/${examId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<ExamResponse>(r)),

  getExam: (examId: string) =>
    apiFetch(`${API_BASE}/api/exams/${examId}`).then((r) => handleResponse<ExamResponse>(r)),

  deleteExam: (examId: string) => apiFetch(`${API_BASE}/api/exams/${examId}`, { method: 'DELETE' }),

  listExams: () =>
    apiFetch(`${API_BASE}/api/exams`)
      .then((r) => handleResponse<ExamListResponse>(r))
      .then((data) => data.exams),

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
    apiFetch(`${API_BASE}/api/exams/${examId}/questions`).then((r) =>
      handleResponse<QuestionResponse[]>(r)
    ),

  // Audio upload (multipart)
  uploadQuestionAudio: (questionId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiFetch(`${API_BASE}/api/questions/${questionId}/audio`, {
      method: 'POST',
      body: formData,
    }).then((r) => handleResponse<AudioUploadResponse>(r))
  },

  uploadQuestionImage: (questionId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiFetch(`${API_BASE}/api/questions/${questionId}/image`, {
      method: 'POST',
      body: formData,
    }).then((r) => handleResponse<ImageUploadResponse>(r))
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
}

// --------------- AI Exam Generation Types ---------------

export interface AIQuestionOption {
  label: string
  content: string
  is_correct: boolean
}

export interface AIQuestion {
  mondai_group: string
  question_number: number
  introduction?: string
  script_text: string
  explanation?: string
  question_text: string
  difficulty?: number
  image_url?: string
  image_file?: File
  audio_url?: string
  source_segment_index?: number
  source_question_index?: number
  source_start_time?: number
  source_end_time?: number
  source_transcript?: string
  hide_question_text?: boolean
  answers: AIQuestionOption[]
}

export interface AITimestampQuestion {
  question_number: number
  start_time: number
  end_time: number
  text?: string
}

export interface AITimestampMondai {
  mondai_number: number
  title: string
  start_time: number
  end_time: number
  questions: AITimestampQuestion[]
}

export interface AISplitSegment {
  segment_index: number
  file_name: string
  start_time: number
  end_time: number
  transcript: string
  refined_transcript?: string
}

export interface AIExamResult {
  audio_id?: string
  audio_file_url?: string | null
  raw_transcript: string
  refined_script: string
  split_segments: AISplitSegment[]
  timestamps?: AITimestampMondai[]
  questions: AIQuestion[]
}

export interface AIJobStatus {
  job_id: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  progress_message: string
  result?: AIExamResult
  error?: string
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
    title: string = ''
  ): Promise<AIJobStatus> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('jlpt_level', jlpt_level)
    formData.append('title', title)
    return apiFetch(`${API_BASE}/api/ai/generate-exam`, {
      method: 'POST',
      body: formData,
    }).then((r) => handleResponse<AIJobStatus>(r))
  },

  /** Poll job status. */
  getJobStatus: (jobId: string): Promise<AIJobStatus> =>
    apiFetch(`${API_BASE}/api/ai/job/${jobId}`).then((r) => handleResponse<AIJobStatus>(r)),

  /** Cleanup job from server memory. */
  deleteJob: (jobId: string): Promise<void> =>
    apiFetch(`${API_BASE}/api/ai/job/${jobId}`, { method: 'DELETE' }).then(() => undefined),
}

// --------------- Random Exam Generation Types ---------------

export interface MondaiCountConfig {
  mondai_id: number
  count: number
}

export interface RandomExamGenerateRequest {
  title: string
  description?: string
  jlpt_level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  mondai_config: MondaiCountConfig[]
}

export interface RandomExamGenerateResponse {
  exam_id: string
  job_id: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  progress_message: string
  title: string
  description?: string
  level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  total_questions: number
  mondai_summary?: Record<string, number>
  questions?: QuestionResponse[]
  error?: string
}

// --------------- Random Exam Generation API Methods ---------------

export const randomExamClient = {
  /**
   * Start random exam generation process
   * Returns job_id for tracking progress
   */
  generateRandomExam: (data: RandomExamGenerateRequest): Promise<RandomExamGenerateResponse> =>
    apiFetch(`${API_BASE}/api/exams/random/generate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<RandomExamGenerateResponse>(r)),

  /**
   * Poll job status for random exam generation
   */
  getRandomExamJobStatus: (
    jobId: string
  ): Promise<RandomExamGenerateResponse> =>
    apiFetch(`${API_BASE}/api/exams/random/job/${jobId}`).then((r) =>
      handleResponse<RandomExamGenerateResponse>(r)
    ),

  /**
   * Get list of all available questions grouped by level and mondai
   * for random selection
   */
  getAvailableQuestions: (
    jlpt_level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  ): Promise<Record<string, QuestionResponse[]>> =>
    apiFetch(`${API_BASE}/api/exams/random/available-questions?level=${jlpt_level}`).then(
      (r) => handleResponse<Record<string, QuestionResponse[]>>(r)
    ),

  /**
   * Create exam from random generation result with merged audio
   */
  createExamFromRandom: (data: {
    exam_id?: string
    title: string
    description?: string
    question_ids: string[]
    audio_file_url?: string
  }): Promise<ExamResponse> =>
    apiFetch(`${API_BASE}/api/exams/random/create`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<ExamResponse>(r)),

  /**
   * Cleanup job from server memory
   */
  deleteRandomExamJob: (jobId: string): Promise<void> =>
    apiFetch(`${API_BASE}/api/exams/random/job/${jobId}`, { method: 'DELETE' }).then(
      () => undefined
    ),
  /**
   * Merge multiple audio files with silence gaps
   * Returns merged audio URL
   */
  mergeAudioFiles: (data: {
    audio_urls: string[]
    silence_duration: number // seconds
  }): Promise<{ merged_audio_url: string }> =>
    apiFetch(`${API_BASE}/api/exams/random/merge-audio`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<{ merged_audio_url: string }>(r)),
}
