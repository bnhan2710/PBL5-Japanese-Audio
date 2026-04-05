import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Sparkles, ChevronLeft, Loader2, Check,
  AlertCircle, Headphones, FileAudio, RotateCcw, Brain, Eye,
  CheckCircle2, Play, Pause, Wand2, Save, Image as ImageIcon,
  Plus, Scissors, Star, Trash2
} from 'lucide-react'
import { aiExamClient, AIJobStatus, AIQuestion, AIExamResult, AIQuestionOption } from './api/examClient'
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
const ANSWER_LABELS = ['A', 'B', 'C', 'D']

function extractMondaiNumber(label: string) {
  const match = label.match(/(\d+)/)
  return match ? Number(match[1]) : 999
}

function sortByMondaiAndQuestion<T extends { mondai_group: string; question_number: number }>(items: T[]) {
  return [...items].sort((a, b) => {
    const mondaiDiff = extractMondaiNumber(a.mondai_group) - extractMondaiNumber(b.mondai_group)
    if (mondaiDiff !== 0) return mondaiDiff
    return a.question_number - b.question_number
  })
}

function composeExplanation(question: AIQuestion) {
  return question.script_text?.trim() || ''
}

function buildAnswerOptions(count: 3 | 4, existing: AIQuestionOption[] = []): AIQuestionOption[] {
  return ANSWER_LABELS.slice(0, count).map((label, index) => ({
    label,
    content: existing[index]?.content ?? '',
    is_correct: existing[index]?.is_correct ?? false,
  }))
}

function inferDifficulty(question: AIQuestion) {
  if (question.answers.length === 3) return 1

  const durationSeconds =
    question.source_start_time !== undefined && question.source_end_time !== undefined
      ? Math.max(0, question.source_end_time - question.source_start_time)
      : 0

  if (durationSeconds > 120) return 5
  if (durationSeconds >= 60) return 4
  if (question.image_url?.trim()) return 2
  return 3
}

// ─── Audio Trimmer ──────────────────────────────────────────────────────────

interface AudioTrimmerProps {
  audioFile: File | null
  initialStart: number
  initialEnd: number
  onSave: (start: number, end: number) => void
  onCancel: () => void
}

function AudioTrimmer({ audioFile, initialStart, initialEnd, onSave, onCancel }: AudioTrimmerProps) {
  const [start, setStart] = useState<number>(initialStart || 0)
  const [end, setEnd] = useState<number>(initialEnd || (initialStart + 10))
  const [startText, setStartText] = useState(() => formatTime(initialStart || 0))
  const [endText, setEndText] = useState(() => formatTime(initialEnd || (initialStart + 10)))
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [audioFile])

  function formatTime(secs: number) {
    const m = Math.floor(Math.max(0, secs) / 60)
    const s = Math.floor(Math.max(0, secs) % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  function parseTime(str: string, fallback: number) {
    const p = str.split(':')
    if (p.length === 2) return (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0)
    if (p.length === 1) return parseInt(p[0]) || 0
    return fallback
  }

  const handleAdjustStart = (offset: number) => {
    setStart(v => {
      const next = Math.max(0, v + offset)
      setStartText(formatTime(next))
      if (audioRef.current) { audioRef.current.currentTime = next; audioRef.current.play().catch(() => { }) }
      return next
    })
  }

  const handleAdjustEnd = (offset: number) => {
    setEnd(v => {
      const next = Math.max(0, v + offset)
      setEndText(formatTime(next))
      if (audioRef.current) { audioRef.current.currentTime = next; audioRef.current.play().catch(() => { }) }
      return next
    })
  }

  const applyStart = () => {
    const s = parseTime(startText, start)
    setStart(s)
    setStartText(formatTime(s))
    if (audioRef.current) { audioRef.current.currentTime = s; audioRef.current.play().catch(() => { }) }
  }

  const applyEnd = () => {
    const e = parseTime(endText, end)
    setEnd(e)
    setEndText(formatTime(e))
    if (audioRef.current) { audioRef.current.currentTime = e; audioRef.current.play().catch(() => { }) }
  }

  return (
    <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
      {objectUrl && (
        <audio ref={audioRef} src={objectUrl} controls className="w-full h-10 outline-none" />
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 w-full">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1"><Play className="w-3 h-3" /> Bắt đầu (mm:ss)</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={startText}
              onChange={e => setStartText(e.target.value)}
              onBlur={applyStart}
              onKeyDown={e => e.key === 'Enter' && applyStart()}
              className="w-20 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 font-mono text-center"
            />
            <button onClick={() => handleAdjustStart(-1)} className="px-2 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300 transition-colors">-1s</button>
            <button onClick={() => handleAdjustStart(+1)} className="px-2 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300 transition-colors">+1s</button>
          </div>
        </div>
        <div className="flex-1 w-full">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1"><Pause className="w-3 h-3" /> Kết thúc (mm:ss)</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={endText}
              onChange={e => setEndText(e.target.value)}
              onBlur={applyEnd}
              onKeyDown={e => e.key === 'Enter' && applyEnd()}
              className="w-20 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 font-mono text-center"
            />
            <button onClick={() => handleAdjustEnd(-1)} className="px-2 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300 transition-colors">-1s</button>
            <button onClick={() => handleAdjustEnd(+1)} className="px-2 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300 transition-colors">+1s</button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
        <button onClick={() => onSave(start, end)} className="flex-1 px-3 py-2 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:from-emerald-600 hover:to-teal-600 transition-colors shadow-sm">
          <Scissors className="w-4 h-4" /> Lưu & Trích xuất
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          Hủy
        </button>
      </div>
    </div>
  )
}

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
            <p className="text-sm font-bold text-violet-800 dark:text-violet-300">Pipeline Local Reazon</p>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 leading-relaxed">
              <span className="font-semibold">Bell splitter</span> → dò `Bell_sound` và loại `Bell_2baku` →
              <span className="font-semibold"> PyDub</span> → cắt từng câu →
              <span className="font-semibold"> ReazonSpeech</span> → sinh script có dấu câu / speaker label →
              tạo draft câu hỏi cục bộ để bạn rà lại và điền đáp án JLPT {level}.
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
          Bắt đầu xử lý audio
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
    { icon: <Upload className="w-4 h-4" />, label: 'Upload audio gốc lên Cloudinary', key: 'upload' },
    { icon: <Eye className="w-4 h-4" />, label: 'Detect bell timestamps bằng Bell_sound + Bell_2baku', key: 'split-detect' },
    { icon: <FileAudio className="w-4 h-4" />, label: 'PyDub cắt audio theo timestamp vừa tìm được', key: 'split-cut' },
    { icon: <Wand2 className="w-4 h-4" />, label: 'ReazonSpeech transcribe từng đoạn audio đã cắt', key: 'reazon' },
    { icon: <Brain className="w-4 h-4" />, label: 'Áp format Reazon: dấu câu + 男：/女：', key: 'refine' },
    { icon: <Sparkles className="w-4 h-4" />, label: 'Tạo draft câu hỏi cục bộ từ script đã tách', key: 'questions' },
    { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Gắn audio clip URL từ timestamp thực', key: 'finalize' },
  ]

  const isDone = job?.status === 'done'
  const isFailed = job?.status === 'failed'
  const progressMsg = job?.progress_message || 'Khởi tạo pipeline...'

  // Determine which step is active from progress message
  const matchedStep = progressMsg.match(/Step\s+(\d+)\//i)
  const activeStep = matchedStep ? Math.max(0, Math.min(steps.length - 1, Number(matchedStep[1]) - 1)) : isDone ? steps.length : -1

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
  audioFile: File | null
}

function Step3Review({ editableQuestions, setEditableQuestions, audioFile }: Step3Props) {
  const [activeQIdx, setActiveQIdx] = useState<number>(0)
  const [isEditingAudio, setIsEditingAudio] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const updateQuestion = (idx: number, patch: Partial<AIQuestion>) => {
    setEditableQuestions(editableQuestions.map((q, i) => {
      if (i !== idx) return q
      const nextQuestion = { ...q, ...patch }
      return {
        ...nextQuestion,
        difficulty: patch.difficulty ?? inferDifficulty(nextQuestion),
      }
    }))
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

  const updateAnswerCount = (qIdx: number, count: 3 | 4) => {
    const q = editableQuestions[qIdx]
    const nextAnswers = buildAnswerOptions(count, q.answers)
    updateQuestion(qIdx, { answers: nextAnswers })
  }

  const handleAddQuestion = (group: string) => {
    const questionsInGroup = editableQuestions.filter(q => q.mondai_group === group)
    const nums = questionsInGroup.map(q => q.question_number).sort((a, b) => a - b)

    let nextNum = 1
    if (nums.length > 0) {
      if (nums[0] > 1) {
        nextNum = 1
      } else {
        nextNum = nums[nums.length - 1] + 1
        for (let i = 0; i < nums.length - 1; i++) {
          if (nums[i + 1] - nums[i] > 1) {
            nextNum = nums[i] + 1
            break
          }
        }
      }
    }

    const lastQ = questionsInGroup[questionsInGroup.length - 1]

    const newQ: AIQuestion = {
      mondai_group: group,
      question_number: nextNum,
      introduction: '',
      script_text: '',
      question_text: '',
      difficulty: lastQ?.difficulty ?? 3,
      answers: buildAnswerOptions(4),
      audio_url: lastQ?.audio_url || undefined,
      source_segment_index: lastQ?.source_segment_index,
      source_start_time: lastQ?.source_start_time,
      source_end_time: lastQ?.source_end_time
    }

    const newQuestions = [...editableQuestions, newQ]
    setEditableQuestions(sortByMondaiAndQuestion(newQuestions))
    setActiveQIdx(newQuestions.indexOf(newQ))
  }

  const handleAddMondai = () => {
    const existingMondaiNumbers = editableQuestions.map(q => extractMondaiNumber(q.mondai_group))
    const nextMondaiNumber = existingMondaiNumbers.length > 0 ? Math.max(...existingMondaiNumbers) + 1 : 1
    const newQ: AIQuestion = {
      mondai_group: `Mondai ${nextMondaiNumber}`,
      question_number: 1,
      introduction: '',
      script_text: '',
      question_text: '',
      difficulty: 3,
      answers: buildAnswerOptions(4),
    }

    const newQuestions = sortByMondaiAndQuestion([...editableQuestions, newQ])
    setEditableQuestions(newQuestions)
    setActiveQIdx(newQuestions.findIndex(
      q => q.mondai_group === newQ.mondai_group && q.question_number === 1,
    ))
    setIsEditingAudio(false)
  }

  const handleDeleteQuestion = (idx: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này không?')) return
    const newQs = [...editableQuestions]
    newQs.splice(idx, 1)
    setEditableQuestions(newQs)
    setActiveQIdx(Math.max(0, idx - 1))
  }

  const handleSaveAudioTrim = (idx: number, start: number, end: number) => {
    const q = editableQuestions[idx]
    if (!q.audio_url) {
      toast({ title: 'Lỗi', description: 'Câu hỏi chưa có file audio gốc.', variant: 'destructive' })
      return
    }

    // Try replace so_ and eo_ in Cloudinary URLs
    let newUrl = q.audio_url
    if (newUrl.includes('cloudinary.com')) {
      if (/so_[\d.]+/.test(newUrl)) {
        newUrl = newUrl.replace(/so_[\d.]+/, `so_${start}`)
      } else {
        newUrl = newUrl.replace('/upload/', `/upload/so_${start}/`)
      }

      if (/eo_[\d.]+/.test(newUrl)) {
        newUrl = newUrl.replace(/eo_[\d.]+/, `eo_${end}`)
      } else {
        newUrl = newUrl.replace('/upload/', `/upload/eo_${end}/`)
      }

      updateQuestion(idx, {
        source_start_time: start,
        source_end_time: end,
        audio_url: newUrl
      })
      setIsEditingAudio(false)
      toast({ title: 'Thành công', description: 'Đã cập nhật đoạn âm thanh!' })
    } else {
      toast({ title: 'Thất bại', description: 'Tính năng cắt âm thanh chỉ hỗ trợ audio Cloudinary.', variant: 'destructive' })
    }
  }

  const handleQuestionImagePick = async (file: File | null) => {
    if (!file) return
    setUploadingImage(true)
    try {
      const localUrl = URL.createObjectURL(file)
      updateQuestion(activeQIdx, { image_url: localUrl, image_file: file })
      toast({ title: 'Đã thêm ảnh', description: 'Ảnh sẽ được lưu khi bạn xuất bản hoặc lưu nháp.' })
    } finally {
      setUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  const groupedQuestions = editableQuestions.reduce((acc, q, idx) => {
    if (!acc[q.mondai_group]) acc[q.mondai_group] = []
    acc[q.mondai_group].push({ q, idx })
    return acc
  }, {} as Record<string, { q: AIQuestion, idx: number }[]>)

  for (const group in groupedQuestions) {
    groupedQuestions[group].sort((a, b) => a.q.question_number - b.q.question_number)
  }
  const orderedGroupedQuestions = Object.entries(groupedQuestions).sort(
    ([groupA], [groupB]) => extractMondaiNumber(groupA) - extractMondaiNumber(groupB),
  )

  const activeQ = editableQuestions[activeQIdx]

  return (
    <div className="space-y-6 mt-4">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sidebar: Question List */}
        <div className="w-full md:w-[300px] shrink-0 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800/20 overflow-hidden flex flex-col h-[700px] shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/80">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">DANH SÁCH CÂU HỎI</h3>
            <span className="text-[10px] font-bold bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
              {editableQuestions.length} câu
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-8">
            {orderedGroupedQuestions.map(([group, qs]) => (
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
                        onClick={() => { setActiveQIdx(idx); setIsEditingAudio(false); }}
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
                  <button
                    onClick={() => handleAddQuestion(group)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                    title="Thêm câu hỏi mới"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddMondai}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 px-4 py-3 text-sm font-bold text-slate-500 hover:border-blue-500 hover:text-blue-500 dark:text-slate-300 dark:hover:text-blue-400 dark:hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Thêm Mondai mới
            </button>
          </div>
        </div>

        {/* Right Content: Detail View */}
        <div className="flex-1 flex flex-col h-[700px]">
          {activeQ ? (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3 sm:flex-row sm:items-center justify-between bg-slate-50/30 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Hiệu đính chi tiết</h2>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 pl-2.5 pr-1 py-1 rounded-md flex items-center gap-1.5 border border-slate-200 dark:border-slate-600">
                      {activeQ.mondai_group}
                      <span className="text-slate-300 dark:text-slate-500 mx-0.5">-</span>
                      Câu
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => updateQuestion(activeQIdx, { question_number: Math.max(1, activeQ.question_number - 1) })} className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-300 font-bold select-none leading-none">-</button>
                        <span className="w-6 text-center">{activeQ.question_number}</span>
                        <button onClick={() => updateQuestion(activeQIdx, { question_number: activeQ.question_number + 1 })} className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-300 font-bold select-none leading-none">+</button>
                      </div>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mr-1">IRT</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => updateQuestion(activeQIdx, { difficulty: star })}
                        className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${(activeQ.difficulty || inferDifficulty(activeQ)) >= star ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
                        title={`${star} sao`}
                      >
                        <Star className={`w-4 h-4 ${(activeQ.difficulty || inferDifficulty(activeQ)) >= star ? 'fill-current' : ''}`} />
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

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Audio */}
                <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Headphones className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">File âm thanh</span>
                  </div>
                  {isEditingAudio ? (
                    <AudioTrimmer
                      audioFile={audioFile}
                      initialStart={activeQ.source_start_time || 0}
                      initialEnd={activeQ.source_end_time || 0}
                      onSave={(s, e) => handleSaveAudioTrim(activeQIdx, s, e)}
                      onCancel={() => setIsEditingAudio(false)}
                    />
                  ) : activeQ.audio_url ? (
                    <div className="flex items-center justify-between gap-4">
                      <audio controls src={activeQ.audio_url} className="w-full h-10 outline-none" />
                      <button onClick={() => setIsEditingAudio(true)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium shrink-0 flex items-center gap-1.5 transition-colors">
                        <Scissors className="w-3.5 h-3.5" /> Chỉnh sửa
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Chưa có audio</p>
                  )}
                </div>

                {/* Question Text */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Kịch bản thô (Raw Transcript)
                  </label>
                  <textarea
                    value={activeQ.source_transcript || ''}
                    onChange={e => updateQuestion(activeQIdx, { source_transcript: e.target.value })}
                    rows={4}
                    placeholder="Nội dung nghe thô từ audio..."
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 leading-relaxed"
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

                {/* Choices */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                      Đáp án lựa chọn (Choices)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Số đáp án</span>
                      {[3, 4].map((count) => {
                        const isActive = activeQ.answers.length === count
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => updateAnswerCount(activeQIdx, count as 3 | 4)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isActive
                                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
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
                  <div className="space-y-3">
                    {activeQ.image_url ? (
                      <img
                        src={activeQ.image_url}
                        alt="Question illustration"
                        className="w-full max-h-56 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                      />
                    ) : null}
                    <input
                      value={activeQ.image_url || ''}
                      onChange={e => updateQuestion(activeQIdx, { image_url: e.target.value, image_file: undefined })}
                      placeholder="Dán URL ảnh hoặc upload bên dưới..."
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                    >
                      <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
                      <p className="text-sm text-slate-500 text-center">
                        <span className="text-blue-500 font-semibold">{uploadingImage ? 'Đang xử lý ảnh...' : 'Thêm ảnh'}</span> hoặc kéo thả
                      </p>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleQuestionImagePick(e.target.files?.[0] ?? null)}
                      />
                    </div>
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
    </div>
  )
}

// ─── Step 4: Save & Publish ──────────────────────────────────────────────────

interface Step4Props {
  questions: AIQuestion[]
  level: Level
  title: string
  draftId: string
  onBack: () => void
}

function Step4Save({ questions, level, title, draftId, onBack }: Step4Props) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeQIdx, setActiveQIdx] = useState<number>(0)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (draftId) {
        await examClient.deleteExam(draftId).catch(() => { })
      }
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
          image_url: q.image_url && !q.image_url.startsWith('blob:') ? q.image_url : undefined,
          explanation: composeExplanation(q),
          difficulty: q.difficulty,
          answers: q.answers.map((a, i) => ({
            question_id: '',
            content: a.content,
            is_correct: a.is_correct,
            order_index: i,
          })),
        }).then(async (createdQuestion) => {
          if (q.image_file) {
            await examClient.uploadQuestionImage(createdQuestion.question_id, q.image_file)
          }
          return createdQuestion
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
  const [aiResult, setAiResult] = useState<AIExamResult | null>(null)

  const [draftId, setDraftId] = useState<string>('')
  const [savingDraft, setSavingDraft] = useState(false)

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
    setEditableQuestions(result.questions.map((question) => ({
      ...question,
      difficulty: inferDifficulty(question),
    })))
    setStep(3)
  }

  const handleJobFailed = (err: string) => {
    setFailed(true)
    setFailedMsg(err)
  }

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    try {
      if (draftId) await examClient.deleteExam(draftId).catch(() => { })
      const exam = await examClient.createExam({
        title: `[Nháp] [${level}] ${title}`,
        time_limit: 60,
      })
      for (const q of editableQuestions) {
        await examClient.createQuestion({
          exam_id: exam.exam_id,
          mondai_group: q.mondai_group,
          question_number: q.question_number,
          question_text: q.question_text,
          audio_clip_url: q.audio_url,
          image_url: q.image_url && !q.image_url.startsWith('blob:') ? q.image_url : undefined,
          explanation: composeExplanation(q),
          difficulty: q.difficulty,
          answers: q.answers.map((a, i) => ({
            question_id: '',
            content: a.content,
            is_correct: a.is_correct,
            order_index: i,
          })),
        }).then(async (createdQuestion) => {
          if (q.image_file) {
            await examClient.uploadQuestionImage(createdQuestion.question_id, q.image_file)
          }
          return createdQuestion
        })
      }
      await examClient.updateExam(exam.exam_id, { is_published: false, current_step: 3 })
      setDraftId(exam.exam_id)
      toast({ title: 'Thành công', description: 'Đã lưu bản nháp!' })
    } catch (e: any) {
      toast({ title: 'Lỗi', description: 'Không thể lưu bản nháp', variant: 'destructive' })
    } finally {
      setSavingDraft(false)
    }
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
                Upload file audio JLPT → split bằng chuông → Reazon tạo script local → tạo draft câu hỏi không dùng Gemini
              </p>
            </>
          )}
        </div>
        {step >= 3 && step < 4 && (
          <div className="flex items-center gap-3 mt-2 md:mt-0">
            <button onClick={handleSaveDraft} disabled={savingDraft} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50">
              {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Lưu bản nháp
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
          aiResult && (
            <Step3Review
              editableQuestions={editableQuestions}
              setEditableQuestions={setEditableQuestions}
              audioFile={audioFile}
            />
          )
        )}

        {step === 4 && (
          <Step4Save
            questions={editableQuestions}
            level={level}
            title={title}
            draftId={draftId}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  )
}
