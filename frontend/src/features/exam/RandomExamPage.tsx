import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, ChevronLeft, Check, Loader2, AlertCircle, Download,
  Trash2, Star, Headphones,
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
  mondaiConfig: MondaiConfig[]
}

interface GeneratedQuestion {
  question_id: string
  mondai_group: string
  question_number: number
  audio_clip_url?: string
  question_text: string
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
  total_questions: number
  questions: GeneratedQuestion[]
  mondai_summary: Record<string, number>
}

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_MONDAI: MondaiConfig[] = [
  { id: 1, label: 'Mondai 1: Task-based Comprehension', nameJa: 'Kadairikai (課題理解)', enabled: true, count: 2 },
  { id: 2, label: 'Mondai 2: Point Comprehension', nameJa: 'Pointorikai (ポイント理解)', enabled: true, count: 3 },
  { id: 3, label: 'Mondai 3: Summary Comprehension', nameJa: 'Gaiyourikai (概要理解)', enabled: true, count: 2 },
  { id: 4, label: 'Mondai 4: Quick Response', nameJa: 'Sokujioutou (即時応答)', enabled: true, count: 4 },
  { id: 5, label: 'Mondai 5: Integrated Comprehension', nameJa: 'Sougourikai (統合理解)', enabled: true, count: 2 },
]

const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1']

// ─── Helper Functions ────────────────────────────────────────────────────

function extractMondaiNumber(label: string) {
  const match = label.match(/(\d+)/)
  return match ? Number(match[1]) : 999
}

function sortQuestions(items: GeneratedQuestion[]): GeneratedQuestion[] {
  return [...items].sort((a, b) => {
    const mondaiDiff = extractMondaiNumber(a.mondai_group) - extractMondaiNumber(b.mondai_group)
    if (mondaiDiff !== 0) return mondaiDiff
    return a.question_number - b.question_number
  })
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
    onConfigChange({ ...config, level })
  }

  const handleMondaiToggle = (id: number) => {
    const updatedConfig = config.mondaiConfig.map(m =>
      m.id === id ? { ...m, enabled: !m.enabled } : m
    )
    onConfigChange({ ...config, mondaiConfig: updatedConfig })
  }

  const handleMondaiCountChange = (id: number, count: number) => {
    const updatedConfig = config.mondaiConfig.map(m =>
      m.id === id ? { ...m, count: Math.max(1, count) } : m
    )
    onConfigChange({ ...config, mondaiConfig: updatedConfig })
  }

  const totalQuestions = config.mondaiConfig
    .filter(m => m.enabled)
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

      {/* Level Selection */}
      <div>
        <label className="block text-sm font-bold text-gray-800 mb-3">
          Trình độ <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-5 gap-2">
          {LEVELS.map(lvl => (
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

      {/* Mondai Configuration */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-bold text-gray-800">
            Cấu hình bộ câu hỏi
          </label>
          <span className="text-sm font-semibold text-blue-600">
            Tổng: {totalQuestions} câu
          </span>
        </div>

        <div className="space-y-3">
          {config.mondaiConfig.map(mondai => (
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
                    onChange={(e) => handleMondaiCountChange(mondai.id, parseInt(e.target.value) || 1)}
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
          .filter(m => m.enabled)
          .map(m => ({
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
          await new Promise(r => setTimeout(r, 1000))
          pollCount++

          const statusResponse = await randomExamClient.getRandomExamJobStatus(jobId)

          if (statusResponse.status === 'done') {
            jobComplete = true
            if (active) setProgress('')
            onComplete({
              exam_id: statusResponse.exam_id,
              title: statusResponse.title,
              level: statusResponse.level,
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
          {config.mondaiConfig
            .filter(m => m.enabled)
            .map(m => (
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
  const [questions, setQuestions] = useState<GeneratedQuestion[]>(
    sortQuestions(result.questions || [])
  )
  const [selectedId, setSelectedId] = useState<string | null>(
    questions.length > 0 ? questions[0].question_id : null
  )
  const [editedData, setEditedData] = useState<Partial<GeneratedQuestion>>({})

  const selectedQuestion = questions.find(q => q.question_id === selectedId)
  const groupedQuestions = questions.reduce((acc, q) => {
    const g = q.mondai_group || 'Khác'
    if (!acc[g]) acc[g] = []
    acc[g].push(q)
    return acc
  }, {} as Record<string, GeneratedQuestion[]>)

  const handleSelectQuestion = (qId: string) => {
    setSelectedId(qId)
    setEditedData({})
  }

  const handleUpdateField = (field: string, value: any) => {
    setEditedData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveChanges = () => {
    if (!selectedQuestion) return
    setQuestions(prev =>
      prev.map(q =>
        q.question_id === selectedId
          ? { ...q, ...editedData }
          : q
      )
    )
    setEditedData({})
    toast({ title: 'Thành công', description: 'Câu hỏi đã được cập nhật' })
  }

  const handleDeleteQuestion = () => {
    if (!selectedQuestion) return
    const next = questions.filter(q => q.question_id !== selectedQuestion.question_id)
    setQuestions(next)
    setSelectedId(next[0]?.question_id ?? null)
    setEditedData({})
    toast({ title: 'Đã xóa câu hỏi' })
  }

  const displayQuestion = selectedQuestion
    ? { ...selectedQuestion, ...editedData }
    : null

  const isDirty = Object.keys(editedData).length > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Hiệu đính & Chỉnh sửa</h2>
        <span className="text-sm font-semibold text-blue-600">
          {questions.length} / {result.total_questions} câu
        </span>
      </div>

      {/* Main Layout: 2 Panel */}
      <div className="grid grid-cols-4 gap-4 flex-1 overflow-hidden" style={{ height: '70vh' }}>
        {/* Left Panel: Questions List */}
        <div className="col-span-1 flex flex-col border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Danh sách câu hỏi</h3>
            <p className="text-xs text-muted-foreground mt-1">{questions.length} câu</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {questions.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Không có câu hỏi
              </div>
            ) : (
              Object.entries(groupedQuestions).map(([group, qs]) => (
                <div key={group} className="px-3 py-3 border-b border-border last:border-b-0">
                  <h4 className="text-xs font-bold text-muted-foreground mb-2">{group}</h4>
                  <div className="flex flex-wrap gap-2">
                    {qs.map(q => (
                      <button
                        key={q.question_id}
                        onClick={() => handleSelectQuestion(q.question_id)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                          selectedId === q.question_id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                            : 'border-border bg-card text-muted-foreground hover:border-blue-300 hover:bg-accent'
                        }`}
                        title={`${group} - Câu ${q.question_number}`}
                      >
                        {q.question_number}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Edit Form */}
        <div className="col-span-3 flex flex-col border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
              <span>{displayQuestion?.mondai_group || 'N/A'}</span>
              <span>-</span>
              <span>Câu</span>
              <button
                onClick={() => {
                  const current = displayQuestion?.question_number || 1
                  handleUpdateField('question_number', Math.max(1, current - 1))
                }}
                className="w-5 h-5 rounded bg-card border border-border text-muted-foreground hover:bg-accent"
                type="button"
              >
                -
              </button>
              <span className="w-5 text-center">{displayQuestion?.question_number || '?'}</span>
              <button
                onClick={() => {
                  const current = displayQuestion?.question_number || 1
                  handleUpdateField('question_number', current + 1)
                }}
                className="w-5 h-5 rounded bg-card border border-border text-muted-foreground hover:bg-accent"
                type="button"
              >
                +
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1">
                <span className="text-xs font-bold text-muted-foreground mr-1">IRT</span>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => handleUpdateField('difficulty', star)}
                    className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${(displayQuestion?.difficulty || 3) >= star ? 'text-amber-400' : 'text-muted-foreground'}`}
                    type="button"
                  >
                    <Star className={`w-3.5 h-3.5 ${(displayQuestion?.difficulty || 3) >= star ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>
              <button
                onClick={handleDeleteQuestion}
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa câu hỏi
              </button>
            </div>
            {isDirty && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  Chưa lưu
                </span>
                <button
                  onClick={handleSaveChanges}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Lưu
                </button>
                <button
                  onClick={() => setEditedData({})}
                  className="px-3 py-1.5 text-xs font-bold bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 transition"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {!displayQuestion ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">Chọn một câu hỏi để chỉnh sửa</p>
              </div>
            ) : (
              <>
                {/* Nội dung câu hỏi */}
                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-2">Nội dung câu hỏi</label>
                  <textarea
                    value={displayQuestion.question_text || ''}
                    onChange={(e) => handleUpdateField('question_text', e.target.value)}
                    rows={2}
                    placeholder="Nhập nội dung câu hỏi..."
                    className="w-full px-4 py-3 border border-border rounded-lg text-sm bg-muted/30 text-card-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-muted-foreground transition-shadow"
                  />
                </div>

                {/* Script */}
                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-2">Kịch bản (Tiếng Nhật)</label>
                  <textarea
                    value={displayQuestion.script_text || ''}
                    onChange={(e) => handleUpdateField('script_text', e.target.value)}
                    rows={4}
                    placeholder="Nhập nội dung hội thoại tiếng Nhật..."
                    className="w-full px-4 py-3 border border-border rounded-lg text-sm bg-muted/30 text-card-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium placeholder:text-muted-foreground transition-shadow"
                  />
                </div>

                {/* Audio */}
                {displayQuestion.audio_clip_url && (
                  <div className="bg-muted/20 border border-border rounded-lg p-4">
                    <label className="block text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                      <Headphones className="w-3.5 h-3.5" /> File âm thanh
                    </label>
                    <audio
                      src={displayQuestion.audio_clip_url}
                      controls
                      preload="metadata"
                      className="w-full h-8"
                    />
                  </div>
                )}

                {/* Giải thích */}
                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-2">Giải thích</label>
                  <textarea
                    value={displayQuestion.explanation || ''}
                    onChange={(e) => handleUpdateField('explanation', e.target.value)}
                    rows={3}
                    placeholder="Nhập giải thích cho câu hỏi..."
                    className="w-full px-4 py-3 border border-border rounded-lg text-sm bg-muted/30 text-card-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium placeholder:text-muted-foreground transition-shadow"
                  />
                </div>

                {/* Đáp án */}
                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-3">
                    Đáp án lựa chọn ({displayQuestion.answers?.length || 0})
                  </label>
                  <div className="space-y-2">
                    {displayQuestion.answers?.map((ans, idx) => (
                      <div key={ans.answer_id} className="flex items-center gap-3 group/answer">
                        <button
                          onClick={() => handleUpdateField('answers', displayQuestion.answers?.map(a => ({
                            ...a,
                            is_correct: a.answer_id === ans.answer_id
                          })) || [])}
                          className="flex flex-col items-center w-10 shrink-0"
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            ans.is_correct
                              ? 'border-emerald-500 bg-emerald-500'
                              : 'border-border hover:border-blue-300'
                          }`}>
                            {ans.is_correct && <span className="w-2 h-2 rounded-full bg-card" />}
                          </div>
                        </button>
                        <div className={`flex-1 border rounded-lg px-4 py-2.5 transition-colors ${
                          ans.is_correct
                            ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-900/10'
                            : 'border-border bg-muted/20 hover:border-border'
                        }`}>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold shrink-0 ${
                              ans.is_correct ? 'text-emerald-600' : 'text-muted-foreground'
                            }`}>
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            <input
                              type="text"
                              value={ans.content || ''}
                              onChange={(e) => handleUpdateField('answers', displayQuestion.answers?.map(a => ({
                                ...a,
                                content: a.answer_id === ans.answer_id ? e.target.value : a.content
                              })) || [])}
                              placeholder={`Nhập nội dung đáp án ${String.fromCharCode(65 + idx)}`}
                              className="w-full text-sm bg-transparent border-0 outline-none text-card-foreground font-medium placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
              )
            }
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" /> Quay lại
          </button>
          <button
            onClick={() => {
              onEdit(questions)
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
        .filter(q => q.audio_clip_url)
        .map(q => q.audio_clip_url as string)

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
      const examResult = await randomExamClient.createExamFromRandom({
        exam_id: result.exam_id,
        title: result.title,
        description: `Sinh từ ${result.total_questions} câu ngẫu nhiên - ${result.level}`,
        question_ids: result.questions.map(q => q.question_id),
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
              Quá trình sinh đề đã hoàn tất. Vui lòng kiểm tra lại thông tin bên dưới trước khi xuất.
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
          <span className="text-sm font-bold text-gray-600">Có file audio</span>
          <p className="text-lg font-semibold text-gray-900">
            {result.questions.filter(q => q.audio_clip_url).length}/{result.total_questions} câu
          </p>
        </div>
        <div>
          <span className="text-sm font-bold text-gray-600">Phân bố theo Mondai</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Object.entries(result.mondai_summary).map(([key, count]) => (
              <div key={key} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
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
    mondaiConfig: DEFAULT_MONDAI,
  })
  const [result, setResult] = useState<RandomExamResult | null>(null)

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step)
  }

  const handleStep1Next = () => setStep(2)

  const handleStep2Complete = (generatedResult: RandomExamResult) => {
    setResult(generatedResult)
    setStep(3)
  }

  const handleStep3Next = () => setStep(4)
  const handleStep4Back = () => setStep(3)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <button
            onClick={() => navigate('/exams')}
            className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 mb-4"
          >
            ← Quay lại
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sinh Đề Thi Ngẫu Nhiên</h1>
          <p className="text-gray-700">Tạo bài thi bằng cách random hoá các câu hỏi hiện có trong hệ thống</p>
        </div>

        <div className="mb-8 overflow-x-auto pb-4">
          <StepIndicator step={step} />
        </div>

        <div className="rounded-xl bg-white p-8 shadow-lg">
          {step === 1 && (
            <Step1_Configuration config={config} onConfigChange={setConfig} onNext={handleStep1Next} />
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
