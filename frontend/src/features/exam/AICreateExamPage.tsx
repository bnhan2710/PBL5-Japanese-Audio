import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Sparkles, ChevronLeft, Loader2, Check,
  AlertCircle, Headphones, FileAudio, RotateCcw, Brain, Eye,
  CheckCircle2, Play, Pause, Wand2, Save, Image as ImageIcon
} from 'lucide-react'
import { aiExamClient, AIJobStatus, AIQuestion, AIExamResult } from './api/examClient'
import { examClient } from './api/examClient'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────────────────────

type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
type WizardStep = 1 | 2 | 3 | 4

const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1']

const LEVEL_COLORS: Record<Level, string> = {
  N5: 'from-emerald-400 to-teal-500',
  N4: 'from-sky-400 to-blue-500',
  N3: 'from-violet-400 to-purple-500',
  N2: 'from-orange-400 to-amber-500',
  N1: 'from-rose-400 to-red-500',
}

const STEP_LABELS = ['Upload & Cấu hình', 'AI Đang xử lý', 'Review kết quả', 'Xác nhận & Lưu']

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: WizardStep }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {STEP_LABELS.map((label, i) => {
        const idx = (i + 1) as WizardStep
        const done = step > idx
        const active = step === idx
        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300
                ${done
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : active
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 border-transparent text-white shadow-lg shadow-violet-500/40'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                }`}>
                {done ? <Check className="w-4 h-4" /> : active && idx === 2 ? <Brain className="w-4 h-4" /> : idx}
              </div>
              <span className={`mt-1.5 text-xs whitespace-nowrap font-medium transition-colors
                ${active ? 'text-violet-600 dark:text-violet-400' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`w-20 h-0.5 mx-2 -mt-5 transition-all duration-500
                ${step > idx ? 'bg-emerald-400' : step === idx ? 'bg-gradient-to-r from-violet-400 to-slate-200 dark:to-slate-700' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Upload & Config ─────────────────────────────────────────────────

interface Step1Props {
  audioFile: File | null
  setAudioFile: (f: File | null) => void
  level: Level
  setLevel: (l: Level) => void
  title: string
  setTitle: (t: string) => void
  onNext: () => Promise<void>
  loading: boolean
}

function Step1({ audioFile, setAudioFile, level, setLevel, title, setTitle, onNext, loading }: Step1Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('audio/') && file.type !== 'application/octet-stream') return
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    setObjectUrl(URL.createObjectURL(file))
    setAudioFile(file)
  }, [objectUrl])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-8">
      {/* Audio upload zone */}
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <FileAudio className="w-4 h-4 text-violet-500" /> File âm thanh bài thi JLPT
        </label>

        {audioFile ? (
          <div className="border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl p-5 bg-emerald-50 dark:bg-emerald-900/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                <Headphones className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 truncate">{audioFile.name}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">{formatSize(audioFile.size)} · {audioFile.type}</p>
              </div>
              {objectUrl && (
                <>
                  <audio ref={audioRef} src={objectUrl} onEnded={() => setPlaying(false)} className="hidden" />
                  <button
                    onClick={() => {
                      if (!audioRef.current) return
                      if (playing) { audioRef.current.pause(); setPlaying(false) }
                      else { audioRef.current.play(); setPlaying(true) }
                    }}
                    className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-600 transition-colors shrink-0 shadow-md">
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                </>
              )}
              <button onClick={() => { setAudioFile(null); setObjectUrl(null) }}
                className="text-xs text-red-500 hover:underline shrink-0">
                Đổi file
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200
              ${dragging
                ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50/40 dark:hover:bg-violet-900/10'
              }`}>
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 flex items-center justify-center">
              <Upload className="w-9 h-9 text-violet-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
                <span className="text-violet-600 dark:text-violet-400">Click để tải lên</span> hoặc kéo thả file
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">MP3, WAV, OGG (tối đa 200MB)</p>
            </div>
            <input ref={inputRef} type="file" accept="audio/*" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
          </div>
        )}
      </div>

      {/* Level + Title row */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Cấp độ JLPT</label>
          <div className="flex gap-2">
            {LEVELS.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all duration-200
                  ${level === l
                    ? `bg-gradient-to-br ${LEVEL_COLORS[l]} border-transparent text-white shadow-lg`
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Tiêu đề đề thi</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={`Ví dụ: Luyện nghe ${level} – Đề số 01`}
            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-shadow" />
        </div>
      </div>

      {/* AI Info banner */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800/50 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-violet-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-violet-800 dark:text-violet-300">Pipeline Hybrid AI</p>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 leading-relaxed">
              <span className="font-semibold">ReazonSpeech</span> (ASR tiếng Nhật) → Transcribe audio chính xác →
              <span className="font-semibold"> Gemini AI</span> → Refine script + Detect timestamps +
              Sinh câu hỏi JLPT {level} với 4 đáp án tự động.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!audioFile || !title.trim() || loading}
          className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Bắt đầu sinh đề với AI
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Processing ──────────────────────────────────────────────────────

interface Step2Props {
  jobId: string
  onDone: (result: AIExamResult) => void
  onFailed: (err: string) => void
}

function Step2Processing({ jobId, onDone, onFailed }: Step2Props) {
  const [job, setJob] = useState<AIJobStatus | null>(null)
  const [dots, setDots] = useState('')

  useEffect(() => {
    const dotInterval = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 600)
    return () => clearInterval(dotInterval)
  }, [])

  useEffect(() => {
    if (!jobId) return
    const poll = async () => {
      try {
        const status = await aiExamClient.getJobStatus(jobId)
        setJob(status)
        if (status.status === 'done' && status.result) {
          onDone(status.result)
        } else if (status.status === 'failed') {
          onFailed(status.error || 'Pipeline thất bại')
        }
      } catch {
        // ignore poll errors
      }
    }
    poll()
    const interval = setInterval(poll, 2500)
    return () => clearInterval(interval)
  }, [jobId])

  const steps = [
    { icon: <FileAudio className="w-4 h-4" />, label: 'ReazonSpeech ASR – Transcribe audio', key: 'reazon' },
    { icon: <Upload className="w-4 h-4" />, label: 'Upload audio lên Gemini Files API', key: 'upload' },
    { icon: <Wand2 className="w-4 h-4" />, label: 'Gemini refine script + speaker detection', key: 'refine' },
    { icon: <Eye className="w-4 h-4" />, label: 'Gemini generate timestamps (mondai/question)', key: 'timestamps' },
    { icon: <Brain className="w-4 h-4" />, label: 'Gemini sinh câu hỏi JLPT + 4 đáp án', key: 'questions' },
  ]

  const isDone = job?.status === 'done'
  const isFailed = job?.status === 'failed'
  const progressMsg = job?.progress_message || 'Khởi tạo pipeline...'

  // Determine which step is active from progress message
  const activeStep = progressMsg.includes('Step 1') ? 0
    : progressMsg.includes('Step 2') ? 1
      : progressMsg.includes('Step 3') ? 2
        : progressMsg.includes('Step 4') ? 3
          : progressMsg.includes('Step 5') ? 4
            : isDone ? 5 : -1

  return (
    <div className="flex flex-col items-center py-6 space-y-8">
      {/* Central animation */}
      <div className="relative w-28 h-28">
        {!isFailed ? (
          <>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 animate-ping opacity-20" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 animate-pulse opacity-40" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/50">
              {isDone
                ? <CheckCircle2 className="w-10 h-10 text-white" />
                : <Brain className="w-10 h-10 text-white animate-pulse" />
              }
            </div>
          </>
        ) : (
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-2xl">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
        )}
      </div>

      <div className="text-center">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {isDone ? 'Sinh đề hoàn thành! 🎉'
            : isFailed ? 'Pipeline thất bại'
              : `AI đang xử lý${dots}`}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{progressMsg}</p>
      </div>

      {/* Pipeline steps */}
      <div className="w-full max-w-lg space-y-3">
        {steps.map((s, i) => {
          const isActive = i === activeStep
          const isDoneStep = activeStep > i || isDone
          return (
            <div key={s.key} className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all duration-300
              ${isDoneStep
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
                : isActive
                  ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 shadow-sm'
                  : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/30 opacity-50'
              }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all
                ${isDoneStep ? 'bg-emerald-500 text-white' : isActive ? 'bg-violet-500 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                {isDoneStep ? <Check className="w-3.5 h-3.5" /> : s.icon}
              </div>
              <span className={`text-sm font-medium flex-1 ${isDoneStep ? 'text-emerald-700 dark:text-emerald-400' : isActive ? 'text-violet-700 dark:text-violet-300' : 'text-slate-400'}`}>
                {s.label}
              </span>
              {isActive && !isFailed && <Loader2 className="w-4 h-4 text-violet-500 animate-spin shrink-0" />}
            </div>
          )
        })}
      </div>

      {isFailed && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800">
          {job?.error}
        </p>
      )}
    </div>
  )
}

// ─── Step 3: Review AI Results ───────────────────────────────────────────────

interface Step3Props {
  editableQuestions: AIQuestion[]
  setEditableQuestions: (qs: AIQuestion[]) => void
}

function Step3Review({ editableQuestions, setEditableQuestions }: Step3Props) {
  const [activeQIdx, setActiveQIdx] = useState<number>(0)

  const updateQuestion = (idx: number, patch: Partial<AIQuestion>) => {
    setEditableQuestions(editableQuestions.map((q, i) => i === idx ? { ...q, ...patch } : q))
  }

  const updateAnswer = (qIdx: number, aIdx: number, patch: { content?: string; is_correct?: boolean }) => {
    const q = editableQuestions[qIdx]
    const answers = q.answers.map((a, i) =>
      patch.is_correct !== undefined
        ? { ...a, is_correct: i === aIdx }
        : i === aIdx ? { ...a, ...patch } : a
    )
    updateQuestion(qIdx, { answers })
  }

  const groupedQuestions = editableQuestions.reduce((acc, q, idx) => {
    if (!acc[q.mondai_group]) acc[q.mondai_group] = []
    acc[q.mondai_group].push({ q, idx })
    return acc
  }, {} as Record<string, { q: AIQuestion, idx: number }[]>)

  const activeQ = editableQuestions[activeQIdx]

  return (
    <div className="flex flex-col md:flex-row gap-6 mt-4">
      {/* Left Sidebar: Question List */}
      <div className="w-full md:w-[300px] shrink-0 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800/20 overflow-hidden flex flex-col h-[700px] shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/80">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">DANH SÁCH CÂU HỎI</h3>
          <span className="text-[10px] font-bold bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
            {editableQuestions.length} câu
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-8">
          {Object.entries(groupedQuestions).map(([group, qs]) => (
            <div key={group}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{group}</h4>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{qs.length} câu</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {qs.map(({ q, idx }) => {
                  const isActive = activeQIdx === idx
                  const hasAnswer = q.answers.some(a => a.is_correct)
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveQIdx(idx)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200
                        ${isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 shadow-sm'
                          : hasAnswer
                            ? 'border-emerald-500 text-emerald-600 bg-white dark:bg-slate-800 dark:border-emerald-600 dark:text-emerald-400 hover:bg-emerald-50'
                            : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:bg-slate-800'
                        }
                      `}
                    >
                      {q.question_number}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Content: Detail View */}
      <div className="flex-1 flex flex-col h-[700px]">
        {activeQ ? (
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Hiệu đính chi tiết</h2>
                <div className="flex gap-2">
                  <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md">
                    {activeQ.mondai_group} - Câu {activeQ.question_number}
                  </span>

                </div>
              </div>

            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Audio */}
              <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Headphones className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">File âm thanh</span>
                </div>
                {activeQ.audio_url ? (
                  <div className="flex items-center justify-between gap-4">
                    <audio controls src={activeQ.audio_url} className="w-full h-10 outline-none" />
                    <button className="text-xs text-blue-500 hover:underline font-medium shrink-0 flex items-center gap-1">
                      <FileAudio className="w-3 h-3" /> Thay thế file audio
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Chưa có audio</p>
                )}
              </div>

              {/* Script */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Kịch bản hội thoại (Script)
                  </label>

                </div>
                <textarea
                  value={activeQ.script_text}
                  onChange={e => updateQuestion(activeQIdx, { script_text: e.target.value })}
                  rows={6}
                  placeholder="Gõ nội dung script..."
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium leading-relaxed"
                />
              </div>

              {/* Question Text */}
              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Nội dung câu hỏi (Question)
                </label>
                <textarea
                  value={activeQ.question_text}
                  onChange={e => updateQuestion(activeQIdx, { question_text: e.target.value })}
                  rows={2}
                  placeholder="Gõ nội dung câu hỏi..."
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Choices */}
              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
                  Đáp án lựa chọn (Choices)
                </label>
                <div className="space-y-3">
                  {activeQ.answers.map((a, ai) => (
                    <div key={ai} className="flex items-center gap-4 group/answer">
                      <button
                        onClick={() => updateAnswer(activeQIdx, ai, { is_correct: true })}
                        className="flex flex-col items-center justify-center w-12 shrink-0 transition-opacity opacity-70 hover:opacity-100"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${a.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'
                          }`}>
                          {a.is_correct && <span className="w-2.5 h-2.5 rounded-full bg-white" />}
                        </div>
                        {a.is_correct ? (
                          <span className="text-[10px] font-bold text-emerald-600 mt-1">Đúng</span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 mt-1 opacity-0 group-hover/answer:opacity-100 transition-opacity">Chọn</span>
                        )}
                      </button>
                      <div className={`flex-1 border rounded-xl px-4 py-3 transition-colors ${a.is_correct ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                        }`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${a.is_correct ? 'text-emerald-500' : 'text-slate-400'}`}>{ai + 1}.</span>
                          <input
                            value={a.content}
                            onChange={e => updateAnswer(activeQIdx, ai, { content: e.target.value })}
                            className="w-full text-sm bg-transparent border-0 outline-none text-slate-700 dark:text-slate-200 font-medium"
                            placeholder="Nhập nội dung đáp án..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Image Upload Placeholder */}
              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Hình ảnh minh họa (Tùy chọn)
                </label>
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                  <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
                  <p className="text-sm text-slate-500 text-center">
                    <span className="text-blue-500 font-semibold">Thêm ảnh</span> hoặc kéo thả
                  </p>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <Brain className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 font-medium">Chọn một câu hỏi ở danh sách bên trái để hiệu đính</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 4: Save & Publish ──────────────────────────────────────────────────

interface Step4Props {
  questions: AIQuestion[]
  level: Level
  title: string
  onBack: () => void
}

function Step4Save({ questions, level, title, onBack }: Step4Props) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeQIdx, setActiveQIdx] = useState<number>(0)

  const handleSave = async () => {
    setSaving(true)
    try {
      // Create exam draft
      const exam = await examClient.createExam({
        title: `[${level}] ${title}`,
        time_limit: 60,
      })

      // Create each question + answers
      for (const q of questions) {
        await examClient.createQuestion({
          exam_id: exam.exam_id,
          mondai_group: q.mondai_group,
          question_number: q.question_number,
          question_text: q.question_text,
          audio_clip_url: q.audio_url,
          explanation: q.script_text || '',
          answers: q.answers.map((a, i) => ({
            question_id: '',
            content: a.content,
            is_correct: a.is_correct,
            order_index: i,
          })),
        })
      }

      // Publish
      await examClient.updateExam(exam.exam_id, { is_published: true, current_step: 3 })
      setSaved(true)
      toast({ title: '🎉 Sinh đề AI thành công!', description: `Đề "${title}" đã được lưu với ${questions.length} câu hỏi.` })
      setTimeout(() => navigate('/exam'), 1500)
    } catch (e: any) {
      toast({ title: 'Lỗi lưu đề', description: e.message || 'Thử lại sau.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const groupedQuestions = questions.reduce((acc, q, idx) => {
    if (!acc[q.mondai_group]) acc[q.mondai_group] = []
    acc[q.mondai_group].push({ q, idx })
    return acc
  }, {} as Record<string, { q: AIQuestion, idx: number }[]>)

  const activeQ = questions[activeQIdx]

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">[{level}] {title}</h3>
            <div className="flex gap-6 mt-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{questions.length}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Câu hỏi</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {Array.from(new Set(questions.map(q => q.mondai_group))).length}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Mondai</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {questions.filter(q => q.answers.some(a => a.is_correct)).length}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Có đáp án</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button onClick={onBack}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
              <ChevronLeft className="w-4 h-4" /> Quay lại chỉnh sửa
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60 transition-all shadow-lg shadow-emerald-500/30">
              {saved ? <CheckCircle2 className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? 'Đã lưu!' : saving ? 'Đang lưu...' : 'Lưu & Xuất bản đề thi'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mt-4">
        {/* Left Sidebar: Question List */}
        <div className="w-full md:w-[300px] shrink-0 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800/20 overflow-hidden flex flex-col h-[600px] shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/80">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">DANH SÁCH CÂU HỎI</h3>
            <span className="text-[10px] font-bold bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
              {questions.length} câu
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-8">
            {Object.entries(groupedQuestions).map(([group, qs]) => (
              <div key={group}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{group}</h4>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{qs.length} câu</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {qs.map(({ q, idx }) => {
                    const isActive = activeQIdx === idx
                    const hasAnswer = q.answers.some(a => a.is_correct)
                    return (
                      <button
                        key={idx}
                        onClick={() => setActiveQIdx(idx)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200
                          ${isActive
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 shadow-sm'
                            : hasAnswer
                              ? 'border-emerald-500 text-emerald-600 bg-white dark:bg-slate-800 dark:border-emerald-600 dark:text-emerald-400 hover:bg-emerald-50'
                              : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:bg-slate-800'
                          }
                        `}
                      >
                        {q.question_number}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Content: Detail View */}
        <div className="flex-1 flex flex-col h-[600px]">
          {activeQ ? (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Chi tiết câu hỏi</h2>
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md">
                      {activeQ.mondai_group} - Câu {activeQ.question_number}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Audio */}
                <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Headphones className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">File âm thanh</span>
                  </div>
                  {activeQ.audio_url ? (
                    <div className="flex items-center justify-between gap-4">
                      <audio controls src={activeQ.audio_url} className="w-full h-10 outline-none" />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Chưa có audio</p>
                  )}
                </div>

                {/* Question Text */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Nội dung câu hỏi (Question)
                  </label>
                  <div className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                    {activeQ.question_text || '(Không có nội dung câu hỏi)'}
                  </div>
                </div>

                {/* Choices */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
                    Đáp án lựa chọn (Choices)
                  </label>
                  <div className="space-y-3">
                    {activeQ.answers.map((a, ai) => (
                      <div key={ai} className="flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center w-12 shrink-0 opacity-100">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${a.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                            {a.is_correct && <span className="w-2.5 h-2.5 rounded-full bg-white" />}
                          </div>
                          {a.is_correct && (
                            <span className="text-[10px] font-bold text-emerald-600 mt-1">Đúng</span>
                          )}
                        </div>
                        <div className={`flex-1 border rounded-xl px-4 py-3 ${a.is_correct ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold ${a.is_correct ? 'text-emerald-500' : 'text-slate-400'}`}>{ai + 1}.</span>
                            <span className="w-full text-sm text-slate-700 dark:text-slate-200 font-medium">
                              {a.content || '(Trống)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Brain className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 font-medium">Chọn một câu hỏi ở danh sách bên trái để xem</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AICreateExamPage() {
  useEffect(() => { }, []) // keep useEffect in imports
  // Step 1 state
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [level, setLevel] = useState<Level>('N2')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 2 state
  const [jobId, setJobId] = useState('')
  const [failed, setFailed] = useState(false)
  const [failedMsg, setFailedMsg] = useState('')

  // Step 3 state
  const [editableQuestions, setEditableQuestions] = useState<AIQuestion[]>([])

  const [step, setStep] = useState<WizardStep>(1)

  const handleStartAI = async () => {
    if (!audioFile || !title.trim()) return
    setLoading(true)
    try {
      const job = await aiExamClient.generateExamFromAudio(audioFile, level, title)
      setJobId(job.job_id)
      setStep(2)
    } catch (e: any) {
      toast({ title: 'Lỗi khởi tạo', description: e.message || 'Không thể bắt đầu pipeline.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleJobDone = (result: AIExamResult) => {
    setEditableQuestions(result.questions)
    setStep(3)
  }

  const handleJobFailed = (err: string) => {
    setFailed(true)
    setFailedMsg(err)
  }

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      {/* Page header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          {step >= 3 ? (
            <div className="mb-2">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                Dự án: Luyện tập JLPT {level} - "{title}"
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Cập nhật lần cuối vừa xong
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Sinh đề bằng AI</h1>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 ml-13">
                Upload file audio JLPT → AI tự động transcribe, phân tích và sinh câu hỏi với đáp án
              </p>
            </>
          )}
        </div>
        {step >= 3 && step < 4 && (
          <div className="flex items-center gap-3 mt-2 md:mt-0">
            <button className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
              Lưu bản nháp
            </button>
            <button onClick={() => setStep(4)}
              className="px-5 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30">
              Tiếp theo: Xem lại
            </button>
          </div>
        )}
      </div>

      {/* Wizard card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl md:rounded-3xl p-4 md:p-8">
        <StepIndicator step={step} />

        {step === 1 && (
          <Step1
            audioFile={audioFile}
            setAudioFile={setAudioFile}
            level={level}
            setLevel={setLevel}
            title={title}
            setTitle={setTitle}
            onNext={handleStartAI}
            loading={loading}
          />
        )}

        {step === 2 && (
          <div>
            {failed ? (
              <div className="text-center py-12 space-y-4">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Pipeline thất bại</p>
                <p className="text-sm text-red-500">{failedMsg}</p>
                <button onClick={() => { setStep(1); setFailed(false); setJobId('') }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors mx-auto">
                  <RotateCcw className="w-4 h-4" /> Thử lại
                </button>
              </div>
            ) : (
              <Step2Processing
                jobId={jobId}
                onDone={handleJobDone}
                onFailed={handleJobFailed}
              />
            )}
          </div>
        )}

        {step === 3 && (
          <Step3Review
            editableQuestions={editableQuestions}
            setEditableQuestions={setEditableQuestions}
          />
        )}

        {step === 4 && (
          <Step4Save
            questions={editableQuestions}
            level={level}
            title={title}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  )
}
