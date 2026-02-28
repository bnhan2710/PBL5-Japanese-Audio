import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Sparkles, ChevronRight, ChevronLeft, Loader2, Check,
  AlertCircle, Headphones, FileAudio, RotateCcw, Eye, Brain,
  CheckCircle2, Play, Pause, Wand2, Save,
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
  result: AIExamResult
  editableQuestions: AIQuestion[]
  setEditableQuestions: (qs: AIQuestion[]) => void
  onBack: () => void
  onNext: () => void
}

function Step3Review({ result, editableQuestions, setEditableQuestions, onBack, onNext }: Step3Props) {
  const [activeTab, setActiveTab] = useState<'questions' | 'script' | 'transcript'>('questions')
  const [expandedQ, setExpandedQ] = useState<number>(0)

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

  const tabs = [
    { key: 'questions' as const, label: `Câu hỏi (${editableQuestions.length})`, icon: <Brain className="w-3.5 h-3.5" /> },
    { key: 'script' as const, label: 'Script tinh chỉnh', icon: <Eye className="w-3.5 h-3.5" /> },
    { key: 'transcript' as const, label: 'Raw Transcript', icon: <FileAudio className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="space-y-5">
      {/* Summary banner */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-violet-800 dark:text-violet-300">AI đã sinh thành công!</p>
          <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
            {editableQuestions.length} câu hỏi · {result.timestamps?.length ?? 0} mondai sections · Có thể chỉnh sửa trước khi lưu
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors
              ${activeTab === t.key
                ? 'border-b-2 border-violet-500 text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'questions' && (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {editableQuestions.map((q, qi) => (
            <div key={qi} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedQ(expandedQ === qi ? -1 : qi)}
                className="w-full flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left">
                <span className="text-xs font-bold bg-violet-600 text-white px-2 py-0.5 rounded shrink-0">
                  {q.mondai_group}
                </span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1 truncate">
                  Câu {q.question_number}: {q.question_text || '(chưa có câu hỏi)'}
                </span>
                <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expandedQ === qi ? 'rotate-90' : ''}`} />
              </button>

              {expandedQ === qi && (
                <div className="p-4 space-y-4 bg-white dark:bg-slate-800">
                  {/* Audio */}
                  {q.audio_url && (
                    <div className="mb-2">
                      <audio controls src={q.audio_url} className="w-full h-10 outline-none" />
                    </div>
                  )}
                  {/* Question text */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Câu hỏi (tiếng Nhật)</label>
                    <textarea
                      value={q.question_text}
                      onChange={e => updateQuestion(qi, { question_text: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>
                  {/* Script */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Script</label>
                    <textarea
                      value={q.script_text}
                      onChange={e => updateQuestion(qi, { script_text: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono" />
                  </div>
                  {/* Answers */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Đáp án (chọn đáp án đúng)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {q.answers.map((a, ai) => (
                        <div key={ai} className={`rounded-lg border p-3 transition-all
                          ${a.is_correct ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <button
                              onClick={() => updateAnswer(qi, ai, { is_correct: true })}
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                                ${a.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                              {a.is_correct && <span className="w-2 h-2 rounded-full bg-white" />}
                            </button>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{a.label}</span>
                          </div>
                          <input
                            value={a.content}
                            onChange={e => updateAnswer(qi, ai, { content: e.target.value })}
                            className="w-full text-xs bg-transparent border-0 outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                            placeholder="Nội dung đáp án..." />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'script' && (
        <pre className="max-h-[500px] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
          {result.refined_script}
        </pre>
      )}

      {activeTab === 'transcript' && (
        <pre className="max-h-[500px] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
          {result.raw_transcript}
        </pre>
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
          <ChevronLeft className="w-4 h-4" /> Quay lại
        </button>
        <button onClick={onNext}
          className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/30">
          Xác nhận & Lưu đề <ChevronRight className="w-4 h-4" />
        </button>
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
          explanation: q.introduction || '',
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

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6">
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

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {Array.from(new Set(questions.map(q => q.mondai_group))).map(group => {
          const groupQs = questions.filter(q => q.mondai_group === group)
          return (
            <div key={group} className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/50">
              <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-1">{group} – {groupQs.length} câu</p>
              <div className="space-y-1">
                {groupQs.slice(0, 3).map((q, i) => (
                  <p key={i} className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Câu {q.question_number}: {q.question_text || '(chưa có nội dung)'}
                  </p>
                ))}
                {groupQs.length > 3 && (
                  <p className="text-xs text-slate-400">...và {groupQs.length - 3} câu khác</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
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
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AICreateExamPage() {
  useEffect(() => {}, []) // keep useEffect in imports
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
  const [aiResult, setAiResult] = useState<AIExamResult | null>(null)
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
    setAiResult(result)
    setEditableQuestions(result.questions)
    setStep(3)
  }

  const handleJobFailed = (err: string) => {
    setFailed(true)
    setFailedMsg(err)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Sinh đề bằng AI</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 ml-13">
          Upload file audio JLPT → AI tự động transcribe, phân tích và sinh câu hỏi với đáp án
        </p>
      </div>

      {/* Wizard card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-3xl p-8">
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

        {step === 3 && aiResult && (
          <Step3Review
            result={aiResult}
            editableQuestions={editableQuestions}
            setEditableQuestions={setEditableQuestions}
            onBack={() => setStep(1)}
            onNext={() => setStep(4)}
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
