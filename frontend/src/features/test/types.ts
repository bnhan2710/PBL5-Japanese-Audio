export interface TestAnswerOption {
 answer_id: string
 content?: string | null
 image_url?: string | null
 order_index?: number | null
}

export interface TestQuestion {
 question_id: string
 mondai_group?: string | null
 question_number?: number | null
 audio_clip_url?: string | null
 question_text?: string | null
 hide_question_text?: boolean
 image_url?: string | null
 difficulty?: number | null
 answers: TestAnswerOption[]
}

export interface TestMondaiGroup {
 label: string
 question_count: number
 start_number?: number | null
 end_number?: number | null
}

export interface TestExamDetail {
 exam_id: string
 title: string
 description?: string | null
 audio_mode?: 'practice' | 'simulation'
 time_limit?: number | null
 is_published: boolean
 audio_url?: string | null
 total_questions: number
 mondai_groups: TestMondaiGroup[]
 questions: TestQuestion[]
}

export interface TestSubmissionAnswer {
 question_id: string
 answer_id?: string | null
}

export interface TestSubmitPayload {
 answers: TestSubmissionAnswer[]
 elapsed_seconds?: number
}

export interface TestSubmitResult {
 result_id: string
 exam_id: string
 score: number
 total_questions: number
 correct_answers: number
 answered_questions: number
 completed_at: string
}

export interface TestAnswerOptionReview extends TestAnswerOption {
 is_correct: boolean
}

export interface TestQuestionReview extends Omit<TestQuestion, 'answers'> {
 answers: TestAnswerOptionReview[]
}

export interface TestExamReviewDetail extends Omit<TestExamDetail, 'questions'> {
 questions: TestQuestionReview[]
}

export interface TestResultReviewResponse {
 result_id: string
 exam_id: string
 score: number
 total_questions: number
 correct_answers: number
 completed_at: string
 exam: TestExamReviewDetail
 user_answers: Record<string, string>
}

export interface CompetencyAnalysisResponse {
 analysis_id: string
 result_id: string
 overview?: string | null
 strengths?: string[] | null
 weaknesses_analysis?: string | null
 actionable_advice?: string[] | null
 skill_metrics?: Record<string, number> | null
 created_at: string
}
