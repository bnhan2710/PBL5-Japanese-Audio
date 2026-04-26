import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  AlertCircle,
  Download,
  Trash2,
  Star,
  Headphones,
  Brain,
  Plus,
} from 'lucide-react'
import { randomExamClient } from './api/examClient'
import { toast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────

type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
type Step = 1 | 2 | 3 | 4

interface MondaiConfig {
  id: number
  label: string
  nameJa: string
  enabled: boolean
  count: number
}

interface RandomExamConfig {
  title: string
  description?: string
  level: Level
  timeLimit: number
  mondaiConfig: MondaiConfig[]
}

interface GeneratedQuestion {
  question_id: string
  mondai_group: string
  question_number: number
  audio_clip_url?: string
  question_text: string
  hide_question_text?: boolean
  script_text: string
  explanation: string
  image_url?: string
  difficulty?: number
  answers: Array<{
    answer_id: string
    content: string
    image_url?: string
    is_correct: boolean
    order_index: number
  }>
}

interface RandomExamResult {
  exam_id: string
  title: string
  level: Level
  time_limit: number
  total_questions: number
  questions: GeneratedQuestion[]
  mondai_summary: Record<string, number>
}

// ─── Constants ────────────────────────────────────────────────────────────

const MONDAI_CONFIG_BY_LEVEL: Record<Level, MondaiConfig[]> = {
  N5: [
    {
      id: 1,
      label: 'Mondai 1: Task-based Comprehension',
      nameJa: 'Kadairikai (課題理解)',
      enabled: true,
      count: 7,
    },
    {
      id: 2,
      label: 'Mondai 2: Point Comprehension',
      nameJa: 'Pointorikai (ポイント理解)',
      enabled: true,
      count: 6,
    },
    {
      id: 3,
      label: 'Mondai 3: Verbal Expressions',
      nameJa: 'Hatsuwa Hyougen (発話表現)',
      enabled: true,
      count: 5,
    },
    {
      id: 4,
      label: 'Mondai 4: Quick Response',
      nameJa: 'Sokujioutou (即時応答)',
      enabled: true,
      count: 6,
    },
  ],
  N4: [
    {
      id: 1,
      label: 'Mondai 1: Task-based Comprehension',
      nameJa: 'Kadairikai (課題理解)',
      enabled: true,
      count: 8,
    },
    {
      id: 2,
      label: 'Mondai 2: Point Comprehension',
      nameJa: 'Pointorikai (ポイント理解)',
      enabled: true,
      count: 7,
    },
    {
      id: 3,
      label: 'Mondai 3: Verbal Expressions',
      nameJa: 'Hatsuwa Hyougen (発話表現)',
      enabled: true,
      count: 5,
    },
    {
      id: 4,
      label: 'Mondai 4: Quick Response',
      nameJa: 'Sokujioutou (即時応答)',
      enabled: true,
      count: 8,
    },
  ],
  N3: [
    {
      id: 1,
      label: 'Mondai 1: Task-based Comprehension',
      nameJa: 'Kadairikai (課題理解)',
      enabled: true,
      count: 6,
    },
    {
      id: 2,
      label: 'Mondai 2: Point Comprehension',
      nameJa: 'Pointorikai (ポイント理解)',
      enabled: true,
      count: 6,
    },
    {
      id: 3,
      label: 'Mondai 3: Summary Comprehension',
      nameJa: 'Gaiyourikai (概要理解)',
      enabled: true,
      count: 3,
    },
    {
      id: 4,
      label: 'Mondai 4: Verbal Expressions',
      nameJa: 'Hatsuwa Hyougen (発話表現)',
      enabled: true,
      count: 4,
    },
    {
      id: 5,
      label: 'Mondai 5: Quick Response',
      nameJa: 'Sokujioutou (即時応答)',
      enabled: true,
      count: 9,
    },
  ],
  N2: [
    {
      id: 1,
      label: 'Mondai 1: Task-based Comprehension',
      nameJa: 'Kadairikai (課題理解)',
      enabled: true,
      count: 5,
    },
    {
      id: 2,
      label: 'Mondai 2: Point Comprehension',
      nameJa: 'Pointorikai (ポイント理解)',
      enabled: true,
      count: 6,
    },
    {
      id: 3,
      label: 'Mondai 3: Summary Comprehension',
      nameJa: 'Gaiyourikai (概要理解)',
      enabled: true,
      count: 5,
    },
    {
      id: 4,
      label: 'Mondai 4: Quick Response',
      nameJa: 'Sokujioutou (即時応答)',
      enabled: true,
      count: 12,
    },
    {
      id: 5,
      label: 'Mondai 5: Integrated Comprehension',
      nameJa: 'Sougourikai (統合理解)',
      enabled: true,
      count: 3,
    },
  ],
  N1: [
    {
      id: 1,
      label: 'Mondai 1: Task-based Comprehension',
      nameJa: 'Kadairikai (課題理解)',
      enabled: true,
      count: 6,
    },
    {
      id: 2,
      label: 'Mondai 2: Point Comprehension',
      nameJa: 'Pointorikai (ポイント理解)',
      enabled: true,
      count: 7,
    },
    {
      id: 3,
      label: 'Mondai 3: Summary Comprehension',
      nameJa: 'Gaiyourikai (概要理解)',
      enabled: true,
      count: 6,
    },
    {
      id: 4,
      label: 'Mondai 4: Quick Response',
      nameJa: 'Sokujioutou (即時応答)',
      enabled: true,
      count: 14,
    },
    {
      id: 5,
      label: 'Mondai 5: Integrated Comprehension',
      nameJa: 'Sougourikai (統合理解)',
      enabled: true,
      count: 4,
    },
  ],
}

const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1']

// ─── Helper Functions ────────────────────────────────────────────────────

function extractMondaiNumber(label: string) {
  const match = label.match(/(\d+)/)
  return match ? Number(match[1]) : 999
}

function generateClientUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function isUUID(value: string | undefined | null): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeEditedQuestions(questions: GeneratedQuestion[]) {
  return questions.map((q) => ({
    question_id: isUUID(q.question_id) ? q.question_id : generateClientUUID(),
    mondai_group: q.mondai_group,
    question_number: q.question_number,
    audio_clip_url: q.audio_clip_url,
    question_text: q.question_text,
    image_url: q.image_url,
    script_text: q.script_text,
    explanation: q.explanation,
    difficulty: q.difficulty,
    hide_question_text: q.hide_question_text,
    answers: q.answers.map((a) => ({
      content: a.content,
      image_url: a.image_url,
      is_correct: a.is_correct,
      order_index: a.order_index,
    })),
  }))
}

// ─── Step Indicator Component ─────────────────────────────────────────────

function StepIndicator({ step, totalSteps = 4 }: { step: number; totalSteps?: number }) {
  const steps = ['Cấu hình', 'Tìm kiếm', 'Hiệu đính', 'Xem lại']
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, idx) => {
        const stepNum = idx + 1
        const isActive = stepNum === step
        const isComplete = stepNum < step
        return (
          <div key={stepNum} className="flex items-center gap-2">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isComplete
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 text-gray-700'
              }`}
            >
              {isComplete ? <Check className="h-5 w-5" /> : stepNum}
            </div>
            <span
              className={`text-sm font-medium ${
                isActive ? 'text-blue-600' : isComplete ? 'text-green-600' : 'text-gray-600'
              }`}
            >
              {label}
            </span>
            {stepNum < totalSteps && <ChevronRight className="h-5 w-5 text-gray-400" />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Configuration ────────────────────────────────────────────────

interface Step1Props {
  config: RandomExamConfig
  onConfigChange: (config: RandomExamConfig) => void
  onNext: () => void
}

function Step1_Configuration({ config, onConfigChange, onNext }: Step1Props) {
  const handleTitleChange = (title: string) => {
    onConfigChange({ ...config, title })
  }

  const handleDescriptionChange = (description: string) => {
    onConfigChange({ ...config, description })
  }

  const handleLevelChange = (level: Level) => {
    onConfigChange({ ...config, level, mondaiConfig: MONDAI_CONFIG_BY_LEVEL[level] })
  }

  const handleTimeLimitChange = (minutes: number) => {
    onConfigChange({ ...config, timeLimit: Math.max(1, Math.min(300, minutes || 1)) })
  }

  const handleMondaiToggle = (id: number) => {
    const updatedConfig = config.mondaiConfig.map((m) =>
      m.id === id ? { ...m, enabled: !m.enabled } : m
    )
    onConfigChange({ ...config, mondaiConfig: updatedConfig })
  }

  const handleMondaiCountChange = (id: number, count: number) => {
    const updatedConfig = config.mondaiConfig.map((m) =>
      m.id === id ? { ...m, count: Math.max(1, count) } : m
    )
    onConfigChange({ ...config, mondaiConfig: updatedConfig })
  }

  const totalQuestions = config.mondaiConfig
    .filter((m) => m.enabled)
    .reduce((sum, m) => sum + m.count, 0)

  const canProceed = config.title.trim().length > 0 && totalQuestions > 0

  return (
    <div className="space-y-8">
      {/* Title & Description */}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            Tiêu đề bài thi <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={config.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Ví dụ: Bài thi luyện tập N2 - Tuần 1"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Mô tả (tùy chọn)</label>
          <textarea
            value={config.description || ''}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Thêm mô tả cho bài thi này..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
          />
        </div>
      </div>

      {/* Level + Time Limit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-3">
            Trình độ <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-5 gap-2">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => handleLevelChange(lvl)}
                className={`py-2.5 rounded-lg font-bold transition-colors ${
                  config.level === lvl
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800 mb-3">
            Thời gian làm bài (Phút)
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Giảm thời gian"
              onClick={() => handleTimeLimitChange(config.timeLimit - 5)}
              className="w-10 h-10 rounded-lg border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xl leading-none font-medium flex items-center justify-center"
            >
              −
            </button>
            <div className="min-w-14 text-center text-3xl font-bold text-gray-800 leading-none">
              {config.timeLimit}
            </div>
            <button
              type="button"
              aria-label="Tăng thời gian"
              onClick={() => handleTimeLimitChange(config.timeLimit + 5)}
              className="w-10 h-10 rounded-lg border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xl leading-none font-medium flex items-center justify-center"
            >
              +
            </button>
          </div>
          <p className="mt-1.5 text-sm text-gray-600">
            Tổng thời gian cho toàn bộ các phần thi bên dưới.
          </p>
        </div>
      </div>

      {/* Mondai Configuration */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-bold text-gray-800">Cấu hình bộ câu hỏi</label>
          <span className="text-sm font-semibold text-blue-600">Tổng: {totalQuestions} câu</span>
        </div>

        <div className="space-y-3">
          {config.mondaiConfig.map((mondai) => (
            <div
              key={mondai.id}
              className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 transition"
            >
              <input
                type="checkbox"
                checked={mondai.enabled}
                onChange={() => handleMondaiToggle(mondai.id)}
                className="h-4 w-4 rounded cursor-pointer accent-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{mondai.label}</div>
                <div className="text-xs text-gray-600">{mondai.nameJa}</div>
              </div>
              {mondai.enabled && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMondaiCountChange(mondai.id, mondai.count - 1)}
                    className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={mondai.count}
                    onChange={(e) =>
                      handleMondaiCountChange(mondai.id, parseInt(e.target.value) || 1)
                    }
                    className="w-12 text-center rounded border border-gray-300 py-1 text-sm font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={() => handleMondaiCountChange(mondai.id, mondai.count + 1)}
                    className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-600 font-medium w-12 text-right">câu</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
            canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Tiếp theo <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Progress ──────────────────────────────────────────────────

interface Step2Props {
  config: RandomExamConfig
  onComplete: (result: RandomExamResult) => void
  onBack: () => void
}

function Step2_Progress({ config, onComplete, onBack }: Step2Props) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const generateExam = async () => {
      try {
        if (active) {
          setError(null)
          setIsProcessing(true)
          setProgress('Khởi chạy quá trình sinh đề thi...')
        }

        // Start random exam generation
        const mondaiConfig = config.mondaiConfig
          .filter((m) => m.enabled)
          .map((m) => ({
            mondai_id: m.id,
            count: m.count,
          }))

        const startResponse = await randomExamClient.generateRandomExam({
          title: config.title,
          description: config.description,
          jlpt_level: config.level,
          mondai_config: mondaiConfig,
        })

        const jobId = startResponse.job_id
        let jobComplete = false
        let pollCount = 0
        const maxPolls = 60 // Max 60 polls = 60 seconds with 1s interval

        // Poll job status
        while (!jobComplete && pollCount < maxPolls) {
          await new Promise((r) => setTimeout(r, 1000))
          pollCount++

          const statusResponse = await randomExamClient.getRandomExamJobStatus(jobId)

          if (statusResponse.status === 'done') {
            jobComplete = true
            if (active) setProgress('')
            onComplete({
              exam_id: statusResponse.exam_id,
              title: statusResponse.title,
              level: statusResponse.level,
              time_limit: config.timeLimit,
              total_questions: statusResponse.total_questions,
              questions: (statusResponse.questions || []) as GeneratedQuestion[],
              mondai_summary: statusResponse.mondai_summary || {},
            })
          } else if (statusResponse.status === 'failed') {
            throw new Error(statusResponse.error || 'Quá trình sinh đề thất bại')
          } else {
            if (active) setProgress(statusResponse.progress_message || 'Đang xử lý...')
          }
        }

        if (!jobComplete) {
          throw new Error('Timeout: Quá trình sinh đề thi mất quá lâu')
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : 'Lỗi không xác định'
          setError(message)
          setProgress('')
          toast({
            title: 'Không thể sinh đề ngẫu nhiên',
            description: message,
            variant: 'destructive',
          })
        }
      } finally {
        if (active) {
          setIsProcessing(false)
        }
      }
    }

    // Delay by one tick so StrictMode's first setup is cleaned up before starting network calls.
    const timer = window.setTimeout(() => {
      void generateExam()
    }, 0)

    return () => {
      window.clearTimeout(timer)
      active = false
    }
  }, [config, onComplete])

  return (
    <div className="space-y-8">
      {/* Progress Display */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-8 text-center">
        {isProcessing ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <div>
              <p className="text-lg font-semibold text-gray-900 mb-2">Đang sinh đề thi...</p>
              {progress && <p className="text-gray-700">{progress}</p>}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12 text-red-600" />
            <div>
              <p className="text-lg font-semibold text-red-900 mb-2">Có lỗi xảy ra</p>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Check className="h-12 w-12 text-green-600" />
            <div>
              <p className="text-lg font-semibold text-green-900">Sinh đề thành công!</p>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Summary */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h3 className="font-bold text-gray-900 mb-4">Cấu hình đã tạo:</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-600">Tiêu đề:</span>
            <p className="font-semibold text-gray-900">{config.title}</p>
          </div>
          <div>
            <span className="text-sm text-gray-600">Trình độ:</span>
            <p className="font-semibold text-gray-900">{config.level}</p>
          </div>
          <div>
            <span className="text-sm text-gray-600">Thời gian:</span>
            <p className="font-semibold text-gray-900">{config.timeLimit} phút</p>
          </div>
          {config.mondaiConfig
            .filter((m) => m.enabled)
            .map((m) => (
              <div key={m.id}>
                <span className="text-sm text-gray-600">{m.label}:</span>
                <p className="font-semibold text-gray-900">{m.count} câu</p>
              </div>
            ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between gap-3 pt-6 border-t border-gray-200">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-5 w-5" /> Quay lại
        </button>
        <button
          disabled={isProcessing || error !== null}
          className={`px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
            isProcessing || error !== null
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          Tiếp theo <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Review & Edit ────────────────────────────────────────────

interface Step3Props {
  result: RandomExamResult
  onEdit: (questions: GeneratedQuestion[]) => void
  onNext: () => void
  onBack: () => void
}

function Step3_ReviewEdit({ result, onEdit, onNext, onBack }: Step3Props) {
  const [questions, setQuestions] = useState<GeneratedQuestion[]>(result.questions || [])
  const [activeQIdx, setActiveQIdx] = useState<number>(0)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)

  useEffect(() => {
    onEdit(questions)
  }, [questions, onEdit])

  const updateQuestion = (idx: number, patch: Partial<GeneratedQuestion>) => {
    setHasUnsavedChanges(true)
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }

  const updateAnswer = (
    qIdx: number,
    aIdx: number,
    patch: { content?: string; is_correct?: boolean }
  ) => {
    const current = questions[qIdx]
    if (!current) return
    const nextAnswers = current.answers.map((a, i) =>
      patch.is_correct !== undefined
        ? { ...a, is_correct: i === aIdx }
        : i === aIdx
          ? { ...a, ...patch }
          : a
    )
    updateQuestion(qIdx, { answers: nextAnswers })
  }

  const updateAnswerCount = (qIdx: number, count: 3 | 4) => {
    const current = questions[qIdx]
    if (!current) return
    const base = [...current.answers]
    if (base.length > count) {
      updateQuestion(qIdx, { answers: base.slice(0, count) })
      return
    }
    const next = [...base]
    while (next.length < count) {
      next.push({
        answer_id: generateClientUUID(),
        content: '',
        is_correct: false,
        order_index: next.length,
      })
    }
    updateQuestion(qIdx, { answers: next })
  }

  const activeQ = questions[activeQIdx]

  const groupedQuestions = questions.reduce(
    (acc, q, idx) => {
      const g = q.mondai_group || 'Khác'
      if (!acc[g]) acc[g] = []
      acc[g].push({ q, idx })
      return acc
    },
    {} as Record<string, Array<{ q: GeneratedQuestion; idx: number }>>
  )

  const orderedGroupedQuestions = Object.entries(groupedQuestions).sort(
    ([a], [b]) => extractMondaiNumber(a) - extractMondaiNumber(b)
  )

  const handleDeleteQuestion = (idx: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này không?')) return
    const next = questions.filter((_, i) => i !== idx)
    setQuestions(next)
    setActiveQIdx(Math.max(0, idx - 1))
    setHasUnsavedChanges(true)
    toast({ title: 'Đã xóa câu hỏi' })
  }

  const handleAddQuestion = (group: string) => {
    const inGroup = questions.filter((q) => q.mondai_group === group)
    const nums = inGroup.map((q) => q.question_number || 0).sort((a, b) => a - b)
    let nextNum = 1
    for (const n of nums) {
      if (n === nextNum) nextNum += 1
      if (n > nextNum) break
    }

    const last = inGroup[inGroup.length - 1]
    const newQuestion: GeneratedQuestion = {
      question_id: generateClientUUID(),
      mondai_group: group,
      question_number: nextNum,
      audio_clip_url: last?.audio_clip_url,
      question_text: '',
      script_text: '',
      explanation: '',
      difficulty: last?.difficulty ?? 3,
      answers: Array.from({ length: 4 }).map((_, i) => ({
        answer_id: generateClientUUID(),
        content: '',
        is_correct: false,
        order_index: i,
      })),
    }

    setQuestions((prev) => {
      const next = [...prev, newQuestion]
      return next
    })
    setActiveQIdx(questions.length)
    setHasUnsavedChanges(true)
  }

  const handleAddMondai = () => {
    const numbers = questions
      .map((q) => extractMondaiNumber(q.mondai_group || ''))
      .filter((n) => n < 999)
    const nextMondai = (numbers.length ? Math.max(...numbers) : 0) + 1
    handleAddQuestion(`Mondai ${nextMondai}`)
  }

  const handleSaveEdits = async () => {
    try {
      setIsSavingDraft(true)
      const normalizedEditedQuestions = normalizeEditedQuestions(questions)
      await randomExamClient.createExamFromRandom({
        exam_id: result.exam_id,
        title: result.title,
        description: `Sinh từ ${questions.length} câu ngẫu nhiên - ${result.level}`,
        question_ids: normalizedEditedQuestions
          .map((q) => q.question_id)
          .filter((id) => isUUID(id)),
        edited_questions: normalizedEditedQuestions,
        time_limit: result.time_limit,
        is_published: false,
      })
      onEdit(questions)
      setHasUnsavedChanges(false)
      toast({ title: 'Đã lưu bản nháp' })
    } catch (err: any) {
      toast({
        title: 'Lưu bản nháp thất bại',
        description: err?.message || 'Không thể lưu bản nháp',
        variant: 'destructive',
      })
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleSaveChanges = () => {
    onEdit(questions)
    setHasUnsavedChanges(false)
    toast({ title: 'Đã lưu thay đổi' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Hiệu đính chi tiết</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-blue-600">
            {questions.length} / {result.total_questions} câu
          </span>
          <button
            onClick={() => void handleSaveEdits()}
            disabled={isSavingDraft}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
              isSavingDraft
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isSavingDraft ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Lưu bản nháp
          </button>
        </div>
      </div>

      <div className="flex gap-4 lg:gap-5">
        <div className="w-full md:w-64 lg:w-72 shrink-0 flex flex-col bg-card shadow-sm rounded-2xl border border-border overflow-hidden max-h-[calc(100vh-260px)] min-h-[680px]">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <h3 className="text-sm font-bold text-card-foreground">Danh sách câu hỏi</h3>
            <p className="text-xs text-muted-foreground mt-1">{questions.length} câu</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {orderedGroupedQuestions.map(([group, qs]) => (
              <div key={group}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-card-foreground">{group}</h4>
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    {qs.length} câu
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {qs.map(({ q, idx }) => (
                    <button
                      key={q.question_id}
                      onClick={() => setActiveQIdx(idx)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200 ${
                        activeQIdx === idx
                          ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 shadow-sm'
                          : q.answers.some((a) => a.is_correct)
                            ? 'border-emerald-500 text-emerald-600 bg-card dark:border-emerald-600 dark:text-emerald-400 hover:bg-emerald-50'
                            : 'border-border text-muted-foreground bg-card hover:border-border'
                      }`}
                      title={`${q.mondai_group} - Câu ${q.question_number}`}
                    >
                      {q.question_number}
                    </button>
                  ))}
                  <button
                    onClick={() => handleAddQuestion(group)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-dashed border-border text-muted-foreground hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                    title="Thêm câu hỏi"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddMondai}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-bold text-muted-foreground hover:border-blue-500 hover:text-blue-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Thêm Mondai mới
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col h-[calc(100vh-260px)] min-h-[680px]">
          {activeQ ? (
            <div className="flex-1 flex flex-col bg-card shadow-sm rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold bg-muted text-muted-foreground pl-2.5 pr-1 py-1 rounded-md flex items-center gap-1.5 border border-border">
                    {activeQ.mondai_group}
                    <span className="mx-0.5">-</span>
                    Câu
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() =>
                          updateQuestion(activeQIdx, {
                            question_number: Math.max(1, (activeQ.question_number || 1) - 1),
                          })
                        }
                        className="w-5 h-5 flex items-center justify-center bg-muted rounded text-muted-foreground hover:bg-slate-300 font-bold leading-none"
                        type="button"
                      >
                        -
                      </button>
                      <span className="w-6 text-center">{activeQ.question_number}</span>
                      <button
                        onClick={() =>
                          updateQuestion(activeQIdx, {
                            question_number: (activeQ.question_number || 1) + 1,
                          })
                        }
                        className="w-5 h-5 flex items-center justify-center bg-muted rounded text-muted-foreground hover:bg-slate-300 font-bold leading-none"
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1">
                    <span className="text-xs font-bold text-muted-foreground mr-1">IRT</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => updateQuestion(activeQIdx, { difficulty: star })}
                        className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-accent ${(activeQ.difficulty || 3) >= star ? 'text-amber-400' : 'text-muted-foreground'}`}
                      >
                        <Star
                          className={`w-4 h-4 ${(activeQ.difficulty || 3) >= star ? 'fill-current' : ''}`}
                        />
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleDeleteQuestion(activeQIdx)}
                    className="w-8 h-8 flex items-center justify-center shrink-0 rounded-lg text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    title="Xóa câu hỏi này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-5">
                {activeQ.audio_clip_url ? (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Headphones className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-bold text-card-foreground">File âm thanh</span>
                    </div>
                    <audio controls src={activeQ.audio_clip_url} className="w-full h-10" />
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-2">
                    Nội dung câu hỏi
                  </label>
                  <textarea
                    value={activeQ.question_text || ''}
                    onChange={(e) => updateQuestion(activeQIdx, { question_text: e.target.value })}
                    rows={2}
                    placeholder="Gõ nội dung câu hỏi..."
                    className="w-full px-4 py-3 border border-border rounded-xl text-sm bg-card text-card-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-card-foreground">
                    Kịch bản hội thoại
                  </label>
                  <textarea
                    value={activeQ.script_text || ''}
                    onChange={(e) => updateQuestion(activeQIdx, { script_text: e.target.value })}
                    rows={6}
                    placeholder="Kịch bản hội thoại..."
                    className="mt-2 w-full px-4 py-3 border border-border rounded-xl text-sm bg-muted text-card-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-2">
                    Giải thích
                  </label>
                  <textarea
                    value={activeQ.explanation || ''}
                    onChange={(e) => updateQuestion(activeQIdx, { explanation: e.target.value })}
                    rows={4}
                    placeholder="Nhập giải thích cho câu hỏi và đáp án đúng..."
                    className="w-full px-4 py-3 border border-border rounded-xl text-sm bg-card text-card-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <label className="block text-sm font-bold text-card-foreground">
                      Đáp án lựa chọn
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Số đáp án</span>
                      {[3, 4].map((count) => {
                        const isActive = activeQ.answers.length === count
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => updateAnswerCount(activeQIdx, count as 3 | 4)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                              isActive
                                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'border-border bg-card text-muted-foreground hover:border-border'
                            }`}
                          >
                            {count} đáp án
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {activeQ.answers.map((a, ai) => (
                      <div
                        key={`${a.answer_id}-${ai}`}
                        className="flex items-center gap-4 group/answer"
                      >
                        <button
                          onClick={() => updateAnswer(activeQIdx, ai, { is_correct: true })}
                          className="flex flex-col items-center justify-center w-12 shrink-0 transition-opacity opacity-70 hover:opacity-100"
                          type="button"
                        >
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              a.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-border'
                            }`}
                          >
                            {a.is_correct ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-card" />
                            ) : null}
                          </div>
                          {a.is_correct ? (
                            <span className="text-[10px] font-bold text-emerald-600 mt-1">
                              Đúng
                            </span>
                          ) : null}
                        </button>
                        <div
                          className={`flex-1 border rounded-xl px-4 py-3 transition-colors ${
                            a.is_correct
                              ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-900/10'
                              : 'border-border bg-card hover:border-border'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-sm font-bold ${a.is_correct ? 'text-emerald-500' : 'text-muted-foreground'}`}
                            >
                              {ai + 1}.
                            </span>
                            <input
                              value={a.content || ''}
                              onChange={(e) =>
                                updateAnswer(activeQIdx, ai, { content: e.target.value })
                              }
                              className="w-full text-sm bg-transparent border-0 outline-none text-card-foreground font-medium"
                              placeholder="Nhập nội dung đáp án..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-2xl border border-border">
              <Brain className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">
                Chọn một câu hỏi ở danh sách bên trái để hiệu đính
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveChanges}
            disabled={!hasUnsavedChanges}
            className={`px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
              hasUnsavedChanges
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Check className="h-5 w-5" /> Lưu thay đổi
          </button>
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" /> Quay lại
          </button>
          <button
            onClick={() => {
              onEdit(questions)
              setHasUnsavedChanges(false)
              onNext()
            }}
            className="px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Tiếp theo <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Final Review & Export ────────────────────────────────────

interface Step4Props {
  result: RandomExamResult
  onBack: () => void
}

function Step4_FinalReview({ result, onBack }: Step4Props) {
  const navigate = useNavigate()
  const [isExporting, setIsExporting] = useState(false)
  const [mergeProgress, setMergeProgress] = useState('')

  const handleExport = async () => {
    try {
      setIsExporting(true)
      setMergeProgress('Chuẩn bị merge audio...')

      const audioUrls = result.questions
        .filter((q) => q.audio_clip_url)
        .map((q) => q.audio_clip_url as string)

      let mergedAudioUrl: string | undefined
      if (audioUrls.length > 0) {
        setMergeProgress(`Đang merge ${audioUrls.length} file audio...`)
        const mergeResult = await randomExamClient.mergeAudioFiles({
          audio_urls: audioUrls,
          silence_duration: 3,
        })
        mergedAudioUrl = mergeResult.merged_audio_url
      }

      setMergeProgress('Đang tạo đề thi...')
      const normalizedEditedQuestions = normalizeEditedQuestions(result.questions)

      const examResult = await randomExamClient.createExamFromRandom({
        exam_id: result.exam_id,
        title: result.title,
        description: `Sinh từ ${result.total_questions} câu ngẫu nhiên - ${result.level}`,
        question_ids: normalizedEditedQuestions
          .map((q) => q.question_id)
          .filter((id) => isUUID(id)),
        edited_questions: normalizedEditedQuestions,
        time_limit: result.time_limit,
        is_published: true,
        audio_file_url: mergedAudioUrl,
      })

      toast({ title: 'Thành công', description: 'Đề thi đã được tạo' })
      navigate(`/exams/${examResult.exam_id}`)
    } catch (err: any) {
      toast({
        title: 'Lỗi',
        description: err?.message || 'Không thể xuất đề thi',
        variant: 'destructive',
      })
    } finally {
      setMergeProgress('')
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <div className="flex items-start gap-4">
          <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-green-900 mb-2">Đề thi đã sẵn sàng!</h3>
            <p className="text-green-800">
              Quá trình sinh đề đã hoàn tất. Vui lòng kiểm tra lại thông tin bên dưới trước khi
              xuất.
            </p>
          </div>
        </div>
      </div>

      {mergeProgress && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800 text-sm font-medium">
          {mergeProgress}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <span className="text-sm font-bold text-gray-600">Tiêu đề</span>
          <p className="text-lg font-semibold text-gray-900">{result.title}</p>
        </div>
        <div>
          <span className="text-sm font-bold text-gray-600">Trình độ</span>
          <p className="text-lg font-semibold text-gray-900">{result.level}</p>
        </div>
        <div>
          <span className="text-sm font-bold text-gray-600">Tổng câu hỏi</span>
          <p className="text-lg font-semibold text-gray-900">{result.total_questions} câu</p>
        </div>
        <div>
          <span className="text-sm font-bold text-gray-600">Thời gian</span>
          <p className="text-lg font-semibold text-gray-900">{result.time_limit} phút</p>
        </div>
        <div>
          <span className="text-sm font-bold text-gray-600">Có file audio</span>
          <p className="text-lg font-semibold text-gray-900">
            {result.questions.filter((q) => q.audio_clip_url).length}/{result.total_questions} câu
          </p>
        </div>
        <div>
          <span className="text-sm font-bold text-gray-600">Phân bố theo Mondai</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Object.entries(result.mondai_summary).map(([key, count]) => (
              <div
                key={key}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
              >
                <span className="text-sm text-gray-700">{key}</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-3 pt-6 border-t border-gray-200">
        <button
          onClick={onBack}
          disabled={isExporting}
          className="px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-5 w-5" /> Quay lại
        </button>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Đang xuất...
            </>
          ) : (
            <>
              <Download className="h-5 w-5" /> Xuất đề thi
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────

export default function RandomExamPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [config, setConfig] = useState<RandomExamConfig>({
    title: '',
    description: '',
    level: 'N2',
    timeLimit: 60,
    mondaiConfig: MONDAI_CONFIG_BY_LEVEL['N2'],
  })
  const [result, setResult] = useState<RandomExamResult | null>(null)

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step)
  }

  const handleStep1Next = () => setStep(2)

  const handleStep2Complete = (generatedResult: RandomExamResult) => {
    setResult({ ...generatedResult, time_limit: config.timeLimit })
    setStep(3)
  }

  const handleStep3Next = () => setStep(4)
  const handleStep4Back = () => setStep(3)

  const handleExitToExamList = async () => {
    try {
      if (result && step >= 3) {
        const normalizedEditedQuestions = normalizeEditedQuestions(result.questions)
        await randomExamClient.createExamFromRandom({
          exam_id: result.exam_id,
          title: result.title,
          description: `Sinh từ ${result.questions.length} câu ngẫu nhiên - ${result.level}`,
          question_ids: normalizedEditedQuestions
            .map((q) => q.question_id)
            .filter((id) => isUUID(id)),
          edited_questions: normalizedEditedQuestions,
          time_limit: result.time_limit,
          is_published: false,
        })
        toast({ title: 'Đã lưu bản nháp' })
      }
    } catch (err: any) {
      toast({
        title: 'Không thể lưu bản nháp',
        description: err?.message || 'Vui lòng thử lại trước khi thoát',
        variant: 'destructive',
      })
      return
    }

    navigate('/exams')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-4 px-3 lg:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-5">
          <button
            onClick={() => void handleExitToExamList()}
            className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 mb-4"
          >
            ← Quay lại
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sinh Đề Thi Ngẫu Nhiên</h1>
          <p className="text-gray-700">
            Tạo bài thi bằng cách random hoá các câu hỏi hiện có trong hệ thống
          </p>
        </div>

        <div className="mb-5 overflow-x-auto pb-2">
          <StepIndicator step={step} />
        </div>

        <div className="rounded-xl bg-white p-5 lg:p-6 shadow-lg">
          {step === 1 && (
            <Step1_Configuration
              config={config}
              onConfigChange={setConfig}
              onNext={handleStep1Next}
            />
          )}
          {step === 2 && (
            <Step2_Progress config={config} onComplete={handleStep2Complete} onBack={handleBack} />
          )}
          {step === 3 && result && (
            <Step3_ReviewEdit
              result={result}
              onEdit={(questions) => setResult({ ...result, questions })}
              onNext={handleStep3Next}
              onBack={handleBack}
            />
          )}
          {step === 4 && result && <Step4_FinalReview result={result} onBack={handleStep4Back} />}
        </div>
      </div>
    </div>
  )
}
