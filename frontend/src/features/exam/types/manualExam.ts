import { z } from 'zod';

export const AnswerSchema = z.object({
  content: z.string().optional(),
  image_url: z.any().optional(),
  is_correct: z.boolean().default(false),
  order_index: z.number().optional(),
});

export const QuestionSchema = z.object({
  id: z.string().optional(), // Local identifier for rendering keys
  mondai_group: z.string().optional(),
  question_number: z.number().optional(),
  audio_clip_url: z.any().optional(), // Can hold File before upload, or string (URL)
  question_text: z.string().optional(),
  image_url: z.any().optional(), // Can hold File before upload, or string (URL)
  explanation: z.string().optional(),
  answers: z.array(AnswerSchema).default([
      { content: '', is_correct: true, order_index: 0 },
      { content: '', is_correct: false, order_index: 1 },
      { content: '', is_correct: false, order_index: 2 },
      { content: '', is_correct: false, order_index: 3 },
  ]),
});

// Maximum questions allowed is normally around 35 for N3/N4, we provide hard limit of 70 (x2).
export const ExamManualSchema = z.object({
  title: z.string().min(1, 'Tên đề thi là bắt buộc'),
  description: z.string().optional(),
  time_limit: z.number().optional(),
  is_published: z.boolean().default(false),
  questions: z.array(QuestionSchema).max(70, 'Không hỗ trợ tạo quá 70 câu hỏi trong một đề (x2 giới hạn JLPT).').default([]),
});

export type AnswerType = z.infer<typeof AnswerSchema>;
export type QuestionType = z.infer<typeof QuestionSchema>;
export type ExamManualType = z.infer<typeof ExamManualSchema>;
