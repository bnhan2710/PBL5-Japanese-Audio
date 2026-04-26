import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Headphones,
  Plus,
  Minus,
  Upload,
  Trash2,
  Play,
  Pause,
  Loader2,
  Star,
  Image as ImageIcon,
  Scissors,
} from 'lucide-react'
import { examClient } from './api/examClient'
import AIPhotoGenerator from './components/AIPhotoGenerator'
import { toast } from '@/hooks/use-toast'

// ─── Types ─────────────────────────────────────────────────────────────────

type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
interface MondaiConfig {
  id: number
  label: string
  nameJa: string
  enabled: boolean
  count: number
}

interface LocalAnswer {
  id: string // temp client id
  content: string
  image_url: string
  is_correct: boolean
  order_index: number
  answer_id?: string // set after save
}

interface LocalQuestion {
  localId: string
  question_id?: string // set after backend save
  mondai_group: string
  question_number: number
  audio_clip_url?: string
  audioFile?: File
  audio_name?: string
  audioUploading?: boolean
  audio_trim_start?: number
  audio_trim_end?: number
  question_text: string
  script_text: string
  explanation: string
  image_url?: string
  image_file?: File
  difficulty?: number
  answers: LocalAnswer[]
  saved: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

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

const makeId = () => Math.random().toString(36).slice(2, 10)

function makeDefaultAnswers(): LocalAnswer[] {
  return [
    { id: makeId(), content: '', image_url: '', is_correct: false, order_index: 0 },
    { id: makeId(), content: '', image_url: '', is_correct: false, order_index: 1 },
    { id: makeId(), content: '', image_url: '', is_correct: false, order_index: 2 },
    { id: makeId(), content: '', image_url: '', is_correct: false, order_index: 3 },
  ]
}

function extractMondaiNumber(label: string) {
  const match = label.match(/(\d+)/)
  return match ? Number(match[1]) : 999
}

function sortQuestions(items: LocalQuestion[]) {
  return [...items].sort((a, b) => {
    const mondaiDiff = extractMondaiNumber(a.mondai_group) - extractMondaiNumber(b.mondai_group)
    if (mondaiDiff !== 0) return mondaiDiff
    return a.question_number - b.question_number
  })
}

function buildLocalQuestions(mondaiList: MondaiConfig[]): LocalQuestion[] {
  const qs: LocalQuestion[] = []
  for (const m of mondaiList) {
    if (!m.enabled) continue
    for (let n = 1; n <= m.count; n++) {
      qs.push({
        localId: makeId(),
        mondai_group: `Mondai ${m.id}`,
        question_number: n,
        question_text: '',
        script_text: '',
        explanation: '',
        difficulty: 3,
        answers: makeDefaultAnswers(),
        saved: false,
      })
    }
  }
  return qs
}

interface AudioTrimmerProps {
  audioFile: File | null
  initialStart: number
  initialEnd: number
  onSave: (start: number, end: number) => void
  onCancel: () => void
}

function formatAudioTime(secs: number) {
  const m = Math.floor(Math.max(0, secs) / 60)
  const s = Math.floor(Math.max(0, secs) % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function parseAudioTime(str: string, fallback: number) {
  const parts = str.split(':')
  if (parts.length === 2) return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0)
  if (parts.length === 1) return parseInt(parts[0]) || 0
  return fallback
}

async function trimAudioFile(file: File, start: number, end: number, nextName: string) {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new AudioContext()
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    const safeStart = Math.max(0, Math.min(start, decoded.duration))
    const safeEnd = Math.max(safeStart, Math.min(end, decoded.duration))
    const frameCount = Math.max(1, Math.floor((safeEnd - safeStart) * decoded.sampleRate))
    const offlineContext = new OfflineAudioContext(
      decoded.numberOfChannels,
      frameCount,
      decoded.sampleRate
    )
    const source = offlineContext.createBufferSource()
    source.buffer = decoded
    source.connect(offlineContext.destination)
    source.start(0, safeStart, Math.max(0.05, safeEnd - safeStart))
    const rendered = await offlineContext.startRendering()

    const wavBuffer = audioBufferToWav(rendered)
    return new File([wavBuffer], `${nextName || file.name.replace(/\.[^.]+$/, '')}.wav`, {
      type: 'audio/wav',
    })
  } finally {
    await audioContext.close()
  }
}

function audioBufferToWav(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const dataLength = buffer.length * blockAlign
  const output = new ArrayBuffer(44 + dataLength)
  const view = new DataView(output)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let i = 0; i < buffer.length; i += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return output
}

function AudioTrimmer({
  audioFile,
  initialStart,
  initialEnd,
  onSave,
  onCancel,
}: AudioTrimmerProps) {
  const [start, setStart] = useState<number>(initialStart || 0)
  const [end, setEnd] = useState<number>(initialEnd || initialStart + 10)
  const [startText, setStartText] = useState(() => formatAudioTime(initialStart || 0))
  const [endText, setEndText] = useState(() => formatAudioTime(initialEnd || initialStart + 10))
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setObjectUrl(null)
    return undefined
  }, [audioFile])

  const handleAdjustStart = (offset: number) => {
    setStart((value) => {
      const next = Math.max(0, value + offset)
      setStartText(formatAudioTime(next))
      if (audioRef.current) {
        audioRef.current.currentTime = next
        audioRef.current.play().catch(() => {})
      }
      return next
    })
  }

  const handleAdjustEnd = (offset: number) => {
    setEnd((value) => {
      const next = Math.max(0, value + offset)
      setEndText(formatAudioTime(next))
      if (audioRef.current) {
        audioRef.current.currentTime = next
        audioRef.current.play().catch(() => {})
      }
      return next
    })
  }

  const applyStart = () => {
    const next = parseAudioTime(startText, start)
    setStart(next)
    setStartText(formatAudioTime(next))
  }

  const applyEnd = () => {
    const next = parseAudioTime(endText, end)
    setEnd(next)
    setEndText(formatAudioTime(next))
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/50 p-4">
      {objectUrl ? (
        <audio ref={audioRef} src={objectUrl} controls className="h-10 w-full outline-none" />
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-bold text-muted-foreground">
            Bắt đầu (mm:ss)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              onBlur={applyStart}
              onKeyDown={(e) => e.key === 'Enter' && applyStart()}
              className="w-20 rounded-lg border border-border bg-card px-3 py-1.5 text-center font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-blue-500 dark:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => handleAdjustStart(-1)}
              className="rounded-md bg-slate-200 px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted dark:text-muted-foreground"
            >
              -1s
            </button>
            <button
              type="button"
              onClick={() => handleAdjustStart(1)}
              className="rounded-md bg-slate-200 px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted dark:text-muted-foreground"
            >
              +1s
            </button>
          </div>
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-bold text-muted-foreground">
            Kết thúc (mm:ss)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={endText}
              onChange={(e) => setEndText(e.target.value)}
              onBlur={applyEnd}
              onKeyDown={(e) => e.key === 'Enter' && applyEnd()}
              className="w-20 rounded-lg border border-border bg-card px-3 py-1.5 text-center font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-blue-500 dark:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => handleAdjustEnd(-1)}
              className="rounded-md bg-slate-200 px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted dark:text-muted-foreground"
            >
              -1s
            </button>
            <button
              type="button"
              onClick={() => handleAdjustEnd(1)}
              className="rounded-md bg-slate-200 px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted dark:text-muted-foreground"
            >
              +1s
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => onSave(start, end)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
        >
          <Scissors className="h-4 w-4" /> Lưu & Trích xuất
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl bg-muted px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted dark:text-muted-foreground"
        >
          Hủy
        </button>
      </div>
    </div>
  )
}

// ─── Step Indicator ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ['Cấu hình', 'Biên tập nội dung', 'Xem lại & Xuất']
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1
        const done = step > idx
        const active = step === idx
        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all
 ${
   done
     ? 'bg-blue-600 border-blue-600 text-white'
     : active
       ? 'bg-blue-600 border-blue-600 text-white'
       : 'bg-card border-border text-muted-foreground'
 }`}
              >
                {done ? <Check className="w-4 h-4" /> : idx}
              </div>
              <span
                className={`mt-1.5 text-xs whitespace-nowrap font-medium
 ${active ? 'text-blue-600' : done ? 'text-muted-foreground' : 'text-muted-foreground'}`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-24 h-0.5 mx-2 -mt-5 ${step > idx ? 'bg-blue-600' : 'bg-muted'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Config ─────────────────────────────────────────────────────────

interface Step1Props {
  level: Level
  setLevel: (l: Level) => void
  title: string
  setTitle: (t: string) => void
  description: string
  setDescription: (t: string) => void
  timeLimit: number
  setTimeLimit: (n: number) => void
  mondai: MondaiConfig[]
  setMondai: (m: MondaiConfig[]) => void
  onNext: () => Promise<void>
  loading: boolean
}

function Step1({
  level,
  setLevel,
  title,
  setTitle,
  description,
  setDescription,
  timeLimit,
  setTimeLimit,
  mondai,
  setMondai,
  onNext,
  loading,
}: Step1Props) {
  const totalQ = mondai.filter((m) => m.enabled).reduce((s, m) => s + m.count, 0)

  const toggle = (id: number) =>
    setMondai(mondai.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)))

  const adjust = (id: number, delta: number) =>
    setMondai(mondai.map((m) => (m.id === id ? { ...m, count: Math.max(0, m.count + delta) } : m)))

  const handleManualCount = (id: number, val: string) => {
    const n = parseInt(val) || 0
    setMondai(mondai.map((m) => (m.id === id ? { ...m, count: Math.max(0, n) } : m)))
  }

  return (
    <div className="space-y-6">
      {/* Level */}
      <div>
        <label className="block text-sm font-semibold text-foreground dark:text-muted-foreground mb-2">
          Cấp độ JLPT
        </label>
        <div className="flex gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all
 ${level === l ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-border text-muted-foreground hover:border-blue-300 hover:text-blue-700 dark:hover:border-blue-500 dark:hover:text-blue-400'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Time and title row */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-foreground dark:text-muted-foreground mb-2">
            Tiêu đề bài nghe
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Luyện nghe N2 – Tháng 12/2025"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground dark:text-muted-foreground mb-2">
            Thời gian làm bài (Phút)
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTimeLimit(Math.max(0, timeLimit - 5))}
              className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 text-center text-xl font-bold bg-transparent border-b border-border focus:border-blue-500 outline-none text-card-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => setTimeLimit(timeLimit + 5)}
              className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tổng thời gian cho toàn bộ các phần thi bên dưới.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-foreground dark:text-muted-foreground mb-2">
            Mô tả đề thi
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Mô tả ngắn về đề thi..."
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-muted-foreground dark:placeholder:text-muted-foreground resize-none"
          />
        </div>
      </div>

      {/* Mondai config */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-foreground dark:text-muted-foreground">
            Cấu hình Mondai (Dạng bài tập)
          </label>
          <span className="text-xs text-muted-foreground">
            Tổng số câu hỏi:{' '}
            <span className="font-bold text-foreground dark:text-muted-foreground">{totalQ}</span>
          </span>
        </div>
        <div className="space-y-2">
          {mondai.map((m) => (
            <div
              key={m.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all
 ${m.enabled ? 'border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/20' : 'border-border bg-muted opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggle(m.id)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors
 ${m.enabled ? 'bg-blue-600 border-blue-600' : 'border-border bg-card'}`}
                >
                  {m.enabled && <Check className="w-3 h-3 text-white" />}
                </button>
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.nameJa}</p>
                </div>
              </div>
              {m.enabled && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">Số câu:</span>
                  <button
                    onClick={() => adjust(m.id, -1)}
                    className="w-7 h-7 rounded border border-border bg-card flex items-center justify-center hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    value={m.count}
                    onChange={(e) => handleManualCount(m.id, e.target.value)}
                    className="w-10 text-center font-bold bg-transparent border-b border-transparent hover:border-border dark:hover:border-slate-600 focus:border-blue-500 outline-none text-card-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => adjust(m.id, 1)}
                    className="w-7 h-7 rounded border border-border bg-card flex items-center justify-center hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!title.trim() || loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Tiếp tục <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Audio Drop Zone ─────────────────────────────────────────────────────────

interface AudioZoneProps {
  question: LocalQuestion
  onUpload: (file: File) => void
  onEdit: () => void
}

function AudioDropZone({ question, onUpload, onEdit }: AudioZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (question.audioFile) {
      const url = URL.createObjectURL(question.audioFile)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setObjectUrl(null)
    return undefined
  }, [question.audioFile])

  const handleFile = (file: File) => {
    if (!file.type.startsWith('audio/')) return
    onUpload(file)
  }

  const seek = (value: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = value
    setProgress(value)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  if (question.audioUploading) {
    return (
      <div className="border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-xl p-8 flex flex-col items-center gap-3 bg-blue-50 dark:bg-blue-900/10">
        <Loader2 className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin" />
        <p className="text-sm font-medium text-blue-600 dark:text-blue-300">
          Đang upload lên Cloudinary…
        </p>
      </div>
    )
  }

  if (question.audio_clip_url || objectUrl) {
    const audioSource = question.audio_clip_url || objectUrl || ''
    return (
      <div className="border-2 border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 bg-emerald-50 dark:bg-emerald-900/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <audio
              ref={audioRef}
              src={audioSource}
              onEnded={() => {
                setPlaying(false)
                setProgress(0)
              }}
              onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.01}
                value={progress}
                onChange={(e) => seek(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-emerald-100 accent-emerald-500"
              />
              <span className="w-20 shrink-0 text-right text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {formatAudioTime(progress)} / {duration > 0 ? formatAudioTime(duration) : '--:--'}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (!audioRef.current) return
              if (playing) {
                audioRef.current.pause()
                setPlaying(false)
              } else {
                audioRef.current.play()
                setPlaying(true)
              }
            }}
            className="w-9 h-9 rounded-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors shrink-0"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-muted-foreground"
            >
              <Scissors className="h-3.5 w-3.5" /> Chỉnh sửa
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-card px-3 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
            >
              <Upload className="h-3.5 w-3.5" /> Đổi file
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0])
          }}
        />
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all
 ${dragging ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-border hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/40 dark:hover:bg-blue-900/10'}`}
    >
      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
        <Upload className="w-6 h-6 text-blue-500 dark:text-blue-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground dark:text-muted-foreground">
          <span className="text-blue-600 dark:text-blue-400">Click để tải lên</span> hoặc kéo thả
          file vào đây
        </p>
        <p className="text-xs text-muted-foreground mt-1">Hỗ trợ MP3, WAV (Tối đa 50MB)</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0])
        }}
      />
    </div>
  )
}

// ─── Step 2: Edit Questions ──────────────────────────────────────────────────

interface Step2Props {
  questions: LocalQuestion[]
  examId: string
  onQuestionsChange: React.Dispatch<React.SetStateAction<LocalQuestion[]>>
  onBack: () => void
}

function Step2({ questions, examId, onQuestionsChange, onBack }: Step2Props) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isEditingAudio, setIsEditingAudio] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const q = questions[selectedIdx]
  const savedCount = questions.filter((q) => q.saved).length
  const groupedQuestions = Array.from(
    questions.reduce((map, question, index) => {
      const bucket = map.get(question.mondai_group) || []
      bucket.push({ question, index })
      map.set(question.mondai_group, bucket)
      return map
    }, new Map<string, Array<{ question: LocalQuestion; index: number }>>())
  ).sort(([a], [b]) => extractMondaiNumber(a) - extractMondaiNumber(b))

  const updateQ = (patch: Partial<LocalQuestion>) => {
    onQuestionsChange((prev) =>
      prev.map((item, i) => (i === selectedIdx ? { ...item, ...patch } : item))
    )
  }

  const updateAnswer = (answerId: string, patch: Partial<LocalAnswer>) => {
    updateQ({ answers: q.answers.map((a) => (a.id === answerId ? { ...a, ...patch } : a)) })
  }

  const toggleCorrect = (answerId: string) => {
    updateQ({
      answers: q.answers.map((a) => ({ ...a, is_correct: a.id === answerId })),
    })
  }

  const updateAnswerCount = (count: 3 | 4) => {
    const nextAnswers = Array.from({ length: count }, (_, index) => {
      const existing = q.answers[index]
      return existing
        ? { ...existing, order_index: index }
        : {
            id: makeId(),
            content: '',
            image_url: '',
            is_correct: false,
            order_index: index,
          }
    })
    const hasCorrect = nextAnswers.some((answer) => answer.is_correct)
    updateQ({
      answers: hasCorrect
        ? nextAnswers
        : nextAnswers.map((answer) => ({ ...answer, is_correct: false })),
    })
  }

  const handleAudioUpload = async (file: File) => {
    setError('')
    updateQ({
      audioFile: file,
      audio_name: file.name.replace(/\.[^.]+$/, ''),
      audio_clip_url: undefined,
      audioUploading: false,
      audio_trim_start: 0,
      audio_trim_end: 10,
      saved: false,
    })
  }

  const handleSaveAudioTrim = async (start: number, end: number) => {
    if (!q.audioFile) return
    try {
      const trimmedFile = await trimAudioFile(
        q.audioFile,
        start,
        end,
        q.audio_name || q.audioFile.name.replace(/\.[^.]+$/, '')
      )
      updateQ({
        audioFile: trimmedFile,
        audio_name: trimmedFile.name.replace(/\.[^.]+$/, ''),
        audio_trim_start: 0,
        audio_trim_end: Math.max(0, end - start),
        audio_clip_url: undefined,
        saved: false,
      })
      setIsEditingAudio(false)
      toast({
        title: 'Đã cắt audio',
        description: 'File audio sẽ được upload theo đoạn đã cắt khi lưu câu hỏi.',
      })
    } catch (e: any) {
      setError(e.message || 'Không thể cắt audio')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      let questionId = q.question_id

      if (!questionId) {
        // Create question
        const created = await examClient.createQuestion({
          exam_id: examId,
          mondai_group: q.mondai_group,
          question_number: q.question_number,
          question_text: q.question_text,
          image_url: q.image_file
            ? null
            : q.image_url && !q.image_url.startsWith('blob:')
              ? q.image_url
              : null,
          script_text: q.script_text,
          explanation: q.explanation,
          difficulty: q.difficulty,
          answers: q.answers.map((a) => ({
            question_id: '', // will be set by server
            content: a.content,
            image_url: a.image_url || undefined,
            is_correct: a.is_correct,
            order_index: a.order_index,
          })),
        })
        questionId = created.question_id
        // Map server answer ids back to local
        const serverAnswers = created.answers
        updateQ({
          question_id: questionId,
          saved: true,
          answers: q.answers.map((a) => ({
            ...a,
            answer_id: serverAnswers.find((sa: any) => sa.order_index === a.order_index)?.answer_id,
          })),
        })
      } else {
        // Update question
        await examClient.updateQuestion(questionId, {
          question_text: q.question_text,
          image_url: q.image_file
            ? null
            : q.image_url && !q.image_url.startsWith('blob:')
              ? q.image_url
              : null,
          script_text: q.script_text,
          explanation: q.explanation,
          difficulty: q.difficulty,
        })
        // Update answers
        for (const a of q.answers) {
          if (a.answer_id) {
            await examClient.updateAnswer(a.answer_id, {
              content: a.content,
              is_correct: a.is_correct,
              order_index: a.order_index,
            })
          }
        }
        updateQ({ saved: true })
      }

      // Upload audio if file present and not yet uploaded
      if (q.audioFile && !q.audio_clip_url && questionId) {
        updateQ({ audioUploading: true })
        const audioRes = await examClient.uploadQuestionAudio(questionId, q.audioFile)
        updateQ({ audio_clip_url: audioRes.audio_clip_url, audioUploading: false, saved: true })
      }

      if (q.image_file && questionId) {
        const imageRes = await examClient.uploadQuestionImage(questionId, q.image_file)
        updateQ({ image_url: imageRes.image_url, image_file: undefined, saved: true })
      }

      // Move to next question
      if (selectedIdx < questions.length - 1) setSelectedIdx(selectedIdx + 1)
    } catch (e: any) {
      setError(e.message || 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteQuestion = async (index: number) => {
    const target = questions[index]
    if (!window.confirm('Xoá câu hỏi này?')) return
    try {
      if (target.question_id) {
        await examClient.deleteQuestion(target.question_id)
      }
      const nextQuestions = questions.filter((_, i) => i !== index)
      onQuestionsChange(nextQuestions)
      setSelectedIdx((current) => Math.max(0, Math.min(current, nextQuestions.length - 1)))
    } catch (e: any) {
      setError(e.message || 'Xoá câu hỏi thất bại')
    }
  }

  const handleDeleteMondai = async (group: string) => {
    const targetQuestions = questions.filter((question) => question.mondai_group === group)
    if (!window.confirm(`Xoá toàn bộ ${group}?`)) return
    try {
      await Promise.all(
        targetQuestions
          .filter((question) => question.question_id)
          .map((question) => examClient.deleteQuestion(question.question_id!))
      )
      const nextQuestions = questions.filter((question) => question.mondai_group !== group)
      onQuestionsChange(nextQuestions)
      setSelectedIdx(0)
    } catch (e: any) {
      setError(e.message || 'Xoá mondai thất bại')
    }
  }

  const handleAddQuestion = (group: string) => {
    const groupQuestions = questions.filter((question) => question.mondai_group === group)
    const nextQuestionNumber =
      groupQuestions.length > 0
        ? Math.max(...groupQuestions.map((question) => question.question_number)) + 1
        : 1

    const newQuestion: LocalQuestion = {
      localId: makeId(),
      mondai_group: group,
      question_number: nextQuestionNumber,
      question_text: '',
      script_text: '',
      explanation: '',
      difficulty: 3,
      answers: makeDefaultAnswers(),
      saved: false,
    }

    const nextQuestions = sortQuestions([...questions, newQuestion])
    onQuestionsChange(nextQuestions)
    setSelectedIdx(nextQuestions.findIndex((item) => item.localId === newQuestion.localId))
  }

  const handleAddMondai = () => {
    const existingMondaiNumbers = questions.map((question) =>
      extractMondaiNumber(question.mondai_group)
    )
    const nextMondaiNumber =
      existingMondaiNumbers.length > 0 ? Math.max(...existingMondaiNumbers) + 1 : 1
    const newQuestion: LocalQuestion = {
      localId: makeId(),
      mondai_group: `Mondai ${nextMondaiNumber}`,
      question_number: 1,
      question_text: '',
      script_text: '',
      explanation: '',
      difficulty: 3,
      answers: makeDefaultAnswers(),
      saved: false,
    }

    const nextQuestions = sortQuestions([...questions, newQuestion])
    onQuestionsChange(nextQuestions)
    setSelectedIdx(nextQuestions.findIndex((item) => item.localId === newQuestion.localId))
  }

  const handleQuestionImagePick = (file: File | null) => {
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    updateQ({ image_url: localUrl, image_file: file })
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleRemoveQuestionImage = () => {
    updateQ({ image_url: '', image_file: undefined })
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  if (!q) {
    return (
      <div className="flex h-[calc(100vh-260px)] min-h-[520px] items-center justify-center rounded-xl border border-border bg-card text-center">
        <div>
          <p className="text-base font-semibold text-foreground dark:text-muted-foreground">
            Không còn câu hỏi nào
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Quay lại bước cấu hình để tạo lại cấu trúc đề thi.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-260px)] min-h-[520px]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border border-border rounded-xl bg-card text-card-foreground overflow-y-auto">
        <div className="p-5 border-b border-border sticky top-0 bg-muted/30 backdrop-blur z-10">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.18em]">
              Danh sách câu hỏi
            </p>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
              {questions.length} câu
            </span>
          </div>
          <p className="text-xs text-blue-400 font-medium mt-2">
            {savedCount}/{questions.length} Hoàn thành
          </p>
        </div>
        {groupedQuestions.map(([group, groupQs]) => {
          return (
            <div key={group}>
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-bold text-muted-foreground">{group}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                    {groupQs.length} câu
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteMondai(group)}
                    className="rounded-md p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    title="Xoá mondai"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5 px-5 pb-4">
                {groupQs.map(({ question: qItem, index: globalIdx }) => {
                  const isActive = globalIdx === selectedIdx
                  return (
                    <button
                      key={qItem.localId}
                      onClick={() => setSelectedIdx(globalIdx)}
                      className={`relative w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
 ${
   isActive
     ? 'border-blue-500 bg-blue-500/15 text-blue-400 shadow-sm'
     : qItem.saved
       ? 'border-border text-muted-foreground bg-muted hover:border-blue-400 hover:bg-accent'
       : 'border-border text-muted-foreground bg-muted hover:border-blue-400 hover:bg-accent'
 }`}
                    >
                      <span>{qItem.question_number}</span>
                      {qItem.saved ? null : (
                        <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-[#0f172a] bg-amber-400 shrink-0" />
                      )}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => handleAddQuestion(group)}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 border-dashed border-border text-muted-foreground hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                  title="Thêm câu hỏi mới"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
        <div className="p-4 pt-2">
          <button
            type="button"
            onClick={handleAddMondai}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-bold text-muted-foreground hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm Mondai mới
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 border border-border rounded-xl bg-card flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Đang chỉnh sửa
            </p>
            <div className="mt-1 flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-1.5">
                <span className="text-sm font-bold text-foreground dark:text-muted-foreground">
                  {q.mondai_group}
                </span>
                <span className="text-muted-foreground">-</span>
                <span className="text-sm font-bold text-foreground dark:text-muted-foreground">
                  Câu
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateQ({ question_number: Math.max(1, q.question_number - 1) })}
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-300 text-sm font-bold text-foreground hover:bg-muted dark:text-muted-foreground"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-card-foreground">
                    {q.question_number}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQ({ question_number: q.question_number + 1 })}
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-300 text-sm font-bold text-foreground hover:bg-muted dark:text-muted-foreground"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted px-2.5 py-1.5">
              <span className="mr-1 text-xs font-bold text-foreground dark:text-muted-foreground">
                IRT
              </span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => updateQ({ difficulty: star })}
                  className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-card/70 ${(q.difficulty || 3) >= star ? 'text-amber-400' : 'text-muted-foreground dark:text-muted-foreground'}`}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${(q.difficulty || 3) >= star ? 'fill-current' : ''}`}
                  />
                </button>
              ))}
            </div>
            <button
              onClick={() => void handleDeleteQuestion(selectedIdx)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xoá
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Audio */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Headphones className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-foreground dark:text-muted-foreground">
                File âm thanh (Audio)
              </p>
            </div>
            {isEditingAudio ? (
              <AudioTrimmer
                audioFile={q.audioFile || null}
                initialStart={q.audio_trim_start || 0}
                initialEnd={q.audio_trim_end || 10}
                onSave={(start, end) => void handleSaveAudioTrim(start, end)}
                onCancel={() => setIsEditingAudio(false)}
              />
            ) : (
              <AudioDropZone
                question={q}
                onUpload={handleAudioUpload}
                onEdit={() => setIsEditingAudio(true)}
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Nội dung câu hỏi{' '}
              <span className="text-muted-foreground font-normal">– Câu hỏi được đọc cuối bài</span>
            </label>
            <textarea
              value={q.question_text}
              onChange={(e) => updateQ({ question_text: e.target.value })}
              rows={3}
              placeholder="Ví dụ: 男の人はこれから何をしますか。"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-card-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Script (Tiếng Nhật){' '}
              <span className="text-muted-foreground font-normal">– Hiển thị khi xem lại</span>
            </label>
            <textarea
              value={q.script_text}
              onChange={(e) => updateQ({ script_text: e.target.value })}
              rows={5}
              placeholder="Nhập nội dung hội thoại tiếng Nhật tại đây..."
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-card-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Giải thích (Explanation){' '}
              <span className="text-muted-foreground font-normal">– Lý do đáp án đúng</span>
            </label>
            <textarea
              value={q.explanation}
              onChange={(e) => updateQ({ explanation: e.target.value })}
              rows={4}
              placeholder="Nhập giải thích cho câu hỏi và đáp án đúng..."
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-card text-card-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
            />
          </div>

          {/* Answers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-card-foreground">Đáp án lựa chọn (Choices)</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Số đáp án</span>
                {[3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => updateAnswerCount(count as 3 | 4)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition-colors ${
                      q.answers.length === count
                        ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30'
                        : 'border-border bg-muted text-muted-foreground hover:border-border dark:text-muted-foreground'
                    }`}
                  >
                    {count} đáp án
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {q.answers.map((ans, ai) => (
                <div key={ans.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCorrect(ans.id)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      ans.is_correct
                        ? 'border-blue-500 bg-blue-500/15'
                        : 'border-border bg-transparent hover:border-border'
                    }`}
                  >
                    {ans.is_correct ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : null}
                  </button>
                  <div
                    className={`flex min-h-[38px] flex-1 items-center rounded-xl border px-3 transition-all ${
                      ans.is_correct
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
                        : 'border-border bg-muted '
                    }`}
                  >
                    <span className="mr-2.5 text-sm font-bold text-muted-foreground">
                      {String.fromCharCode(65 + ai)}.
                    </span>
                    <input
                      value={ans.content}
                      onChange={(e) => updateAnswer(ans.id, { content: e.target.value })}
                      placeholder="Nhập nội dung đáp án..."
                      className="w-full bg-transparent text-[13px] font-medium text-foreground outline-none placeholder:text-muted-foreground dark:text-muted-foreground dark:placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <label className="block text-sm font-bold text-card-foreground">
                Hình ảnh minh họa
              </label>
              {q.image_url ? (
                <button
                  type="button"
                  onClick={handleRemoveQuestionImage}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xoá ảnh
                </button>
              ) : null}
            </div>
            <div className="space-y-3">
              {q.image_url ? (
                <div className="w-full overflow-hidden rounded-xl border border-border bg-muted">
                  <img
                    src={q.image_url}
                    alt="Question illustration"
                    className="w-full h-auto object-contain"
                  />
                </div>
              ) : null}
              <input
                value={q.image_url || ''}
                onChange={(e) => updateQ({ image_url: e.target.value, image_file: undefined })}
                placeholder="Dán URL ảnh hoặc upload bên dưới..."
                className="w-full px-4 py-3 border border-border rounded-xl text-sm bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div
                onClick={() => imageInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center bg-muted/50 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer group"
              >
                <ImageIcon className="w-8 h-8 text-muted-foreground group-hover:text-blue-500 mb-2 transition-colors" />
                <p className="text-sm text-muted-foreground text-center">
                  <span className="text-blue-500 font-semibold">Thêm ảnh</span> hoặc kéo thả
                </p>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleQuestionImagePick(e.target.files?.[0] ?? null)}
                />
              </div>
              <AIPhotoGenerator
                questionText={q.question_text}
                scriptText={q.script_text}
                answers={q.answers}
                onSelectImage={(file, previewUrl) =>
                  updateQ({ image_url: previewUrl, image_file: file })
                }
              />
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted shrink-0">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {!error && (
            <p className="text-xs text-muted-foreground">
              Lần sửa cuối:{' '}
              {new Date().toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })} hôm nay
            </p>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
            >
              Quay lại
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Lưu câu hỏi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Review ─────────────────────────────────────────────────────────

interface Step3Props {
  questions: LocalQuestion[]
  examTitle: string
  onBack: () => void
  onPublish: () => Promise<void>
  publishing: boolean
}

function Step3({ questions, examTitle, onBack, onPublish, publishing }: Step3Props) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const savedCount = questions.filter((q) => q.saved).length
  const q = questions[selectedIdx]
  const groupedQuestions = Array.from(
    questions.reduce((map, question, index) => {
      const bucket = map.get(question.mondai_group) || []
      bucket.push({ question, index })
      map.set(question.mondai_group, bucket)
      return map
    }, new Map<string, Array<{ question: LocalQuestion; index: number }>>())
  ).sort(([a], [b]) => extractMondaiNumber(a) - extractMondaiNumber(b))

  if (!q) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 dark:border-blue-800/50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <h3 className="text-base font-bold text-card-foreground">{examTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Đã hoàn thành:{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {savedCount}/{questions.length}
            </span>{' '}
            câu hỏi
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-base font-semibold text-foreground dark:text-muted-foreground">
            Không có câu hỏi để xem lại
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 dark:border-blue-800/50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <h3 className="text-base font-bold text-card-foreground">{examTitle}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Đã hoàn thành:{' '}
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {savedCount}/{questions.length}
          </span>{' '}
          câu hỏi
        </p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-260px)] min-h-[520px]">
        <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-border bg-card text-card-foreground text-white">
          <div className="sticky top-0 z-10 border-b border-slate-700 bg-muted/30 backdrop-blur p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Danh sách câu hỏi
              </p>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                {questions.length} câu
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-blue-400">
              {savedCount}/{questions.length} Hoàn thành
            </p>
          </div>
          {groupedQuestions.map(([group, groupQs]) => (
            <div key={group}>
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-sm font-bold text-muted-foreground">{group}</p>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                  {groupQs.length} câu
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5 px-5 pb-4">
                {groupQs.map(({ question: qItem, index }) => {
                  const isActive = index === selectedIdx
                  return (
                    <button
                      key={qItem.localId}
                      type="button"
                      onClick={() => setSelectedIdx(index)}
                      className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-500/15 text-blue-400 shadow-sm'
                          : qItem.saved
                            ? 'border-border bg-muted text-muted-foreground hover:border-blue-400 hover:bg-accent'
                            : 'border-border bg-muted text-muted-foreground hover:border-blue-400 hover:bg-accent'
                      }`}
                    >
                      <span>{qItem.question_number}</span>
                      {qItem.saved ? null : (
                        <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-[#0f172a] bg-amber-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Xem lại
              </p>
              <div className="mt-1 flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-1.5">
                  <span className="text-sm font-bold text-foreground dark:text-muted-foreground">
                    {q.mondai_group}
                  </span>
                  <span className="text-muted-foreground">-</span>
                  <span className="text-sm font-bold text-foreground dark:text-muted-foreground">
                    Câu {q.question_number}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted px-2.5 py-1.5">
              <span className="mr-1 text-xs font-bold text-foreground dark:text-muted-foreground">
                IRT
              </span>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`${(q.difficulty || 3) >= star ? 'text-amber-400' : 'text-muted-foreground dark:text-muted-foreground'}`}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${(q.difficulty || 3) >= star ? 'fill-current' : ''}`}
                  />
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Headphones className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-semibold text-foreground dark:text-muted-foreground">
                  File âm thanh (Audio)
                </p>
              </div>
              {q.audio_clip_url ? (
                <div className="rounded-xl border border-border bg-muted/50 p-4">
                  <audio controls src={q.audio_clip_url} className="h-10 w-full outline-none" />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/50 p-6 text-sm text-muted-foreground">
                  Chưa có audio
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Nội dung câu hỏi
              </label>
              <textarea
                value={q.question_text}
                readOnly
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none dark:text-muted-foreground"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Script (Tiếng Nhật)
              </label>
              <textarea
                value={q.script_text}
                readOnly
                rows={5}
                className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none dark:text-muted-foreground"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Giải thích (Explanation)
              </label>
              <textarea
                value={q.explanation}
                readOnly
                rows={4}
                className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none dark:text-muted-foreground"
              />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-base font-bold text-card-foreground">
                  Đáp án lựa chọn (Choices)
                </p>
                <span className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground dark:text-muted-foreground">
                  {q.answers.length} đáp án
                </span>
              </div>
              <div className="space-y-3">
                {q.answers.map((ans, ai) => (
                  <div key={ans.id} className="flex items-center gap-2">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${ans.is_correct ? 'border-blue-500 bg-blue-500/15' : 'border-border'}`}
                    >
                      {ans.is_correct ? (
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                      ) : null}
                    </div>
                    <div
                      className={`flex min-h-[38px] flex-1 items-center rounded-xl border px-3 ${ans.is_correct ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20' : 'border-border bg-muted '}`}
                    >
                      <span className="mr-2.5 text-sm font-bold text-muted-foreground">
                        {String.fromCharCode(65 + ai)}.
                      </span>
                      <input
                        value={ans.content}
                        readOnly
                        className="w-full bg-transparent text-[13px] font-medium text-foreground outline-none dark:text-muted-foreground"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-card-foreground">
                Hình ảnh minh họa
              </label>
              <div className="space-y-3">
                {q.image_url ? (
                  <img
                    src={q.image_url}
                    alt="Question illustration"
                    className="max-h-56 w-full rounded-xl border border-border object-cover"
                  />
                ) : null}
                <input
                  value={q.image_url || ''}
                  readOnly
                  placeholder="Chưa có URL ảnh"
                  className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground outline-none dark:text-muted-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Quay lại biên tập
        </button>
        <button
          onClick={onPublish}
          disabled={publishing || savedCount === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {publishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Xuất bản đề thi
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CreateExamPage() {
  const navigate = useNavigate()

  // Step 1 state
  const [level, setLevel] = useState<Level>('N2')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [timeLimit, setTimeLimit] = useState(50)
  const [mondai, setMondai] = useState<MondaiConfig[]>(MONDAI_CONFIG_BY_LEVEL['N2'])

  const handleSetLevel = (newLevel: Level) => {
    setLevel(newLevel)
    setMondai(MONDAI_CONFIG_BY_LEVEL[newLevel])
  }

  // Step 2 state
  const [examId, setExamId] = useState('')
  const [questions, setQuestions] = useState<LocalQuestion[]>([])

  // Wizard
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const handleStep1Next = async () => {
    setLoading(true)
    try {
      const exam = await examClient.createExam({
        title: `[${level}] ${title}`,
        description,
        time_limit: timeLimit,
      })
      await examClient.updateExam(exam.exam_id, { current_step: 2 })
      setExamId(exam.exam_id)
      setQuestions(sortQuestions(buildLocalQuestions(mondai)))
      setStep(2)
    } catch (e: any) {
      toast({
        title: 'Lỗi',
        description: e.message || 'Không thể tạo đề, thử lại.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStep2Next = async () => {
    await examClient.updateExam(examId, { current_step: 3 }).catch(() => null)
    setStep(3)
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      if (questions.some((q) => q.audio_clip_url || q.audioFile)) {
        toast({
          title: 'Đang xử lý',
          description:
            'Đang gộp file âm thanh đề thi, quá trình này có thể tốn một chút thời gian...',
        })
        await examClient.mergeExamAudio(examId)
      }
      await examClient.updateExam(examId, { is_published: true, current_step: 3 })
      toast({
        title: 'Xuất bản thành công! 🎉',
        description: 'Đề thi đã được xuất bản và sẵn sàng sử dụng.',
      })
      navigate('/exam')
    } catch (e: any) {
      toast({
        title: 'Lỗi xuất bản',
        description: e.message || 'Xuất bản thất bại',
        variant: 'destructive',
      })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] p-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-card-foreground">Tạo đề thi thủ công</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === 1
            ? 'Thiết lập cấu trúc đề thi và tự biên tập nội dung câu hỏi'
            : step === 2
              ? `Biên tập chi tiết nội dung từng câu hỏi cho đề thi ${level}`
              : 'Xem lại và xuất bản đề thi'}
        </p>
      </div>

      {/* Wizard card */}
      <div className="bg-card border border-border shadow-sm rounded-2xl p-8">
        <StepIndicator step={step} />
        {step === 1 && (
          <Step1
            level={level}
            setLevel={handleSetLevel}
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            timeLimit={timeLimit}
            setTimeLimit={setTimeLimit}
            mondai={mondai}
            setMondai={setMondai}
            onNext={handleStep1Next}
            loading={loading}
          />
        )}
        {step === 2 && (
          <Step2
            questions={questions}
            examId={examId}
            onQuestionsChange={setQuestions}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3
            questions={questions}
            examTitle={`[${level}] ${title}`}
            onBack={() => setStep(2)}
            onPublish={handlePublish}
            publishing={publishing}
          />
        )}
      </div>

      {step === 2 && (
        <div className="flex justify-end mt-4">
          <button
            onClick={handleStep2Next}
            className="flex items-center gap-2 px-5 py-2.5 bg-muted text-white rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors"
          >
            Tiếp tục xem lại <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
