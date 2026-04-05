import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, ChevronLeft, Check, Headphones, Plus, Minus,
  Upload, Trash2, Play, Pause, Loader2,
  Star, Image as ImageIcon, Scissors,
} from 'lucide-react'
import { examClient } from './api/examClient'
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
  id: string          
  content: string
  image_url: string
  is_correct: boolean
  order_index: number
  answer_id?: string  
}

interface LocalQuestion {
  localId: string
  question_id?: string  
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

// ─── Constants & Helpers ────────────────────────────────────────────────────

const DEFAULT_MONDAI: MondaiConfig[] = [
  { id: 1, label: 'Mondai 1: Task-based Comprehension',  nameJa: 'Kadairikai (課題理解)',   enabled: true, count: 5 },
  { id: 2, label: 'Mondai 2: Point Comprehension',       nameJa: 'Pointorikai (ポイント理解)', enabled: true, count: 6 },
  { id: 3, label: 'Mondai 3: Summary Comprehension',     nameJa: 'Gaiyourikai (概要理解)',  enabled: true, count: 5 },
  { id: 4, label: 'Mondai 4: Quick Response',            nameJa: 'Sokujioutou (即時応答)',  enabled: true, count: 12 },
  { id: 5, label: 'Mondai 5: Integrated Comprehension',  nameJa: 'Sougourikai (統合理解)', enabled: true, count: 4 },
]

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

// ─── Audio Utilities ────────────────────────────────────────────────────────

async function trimAudioFile(file: File, start: number, end: number, nextName: string) {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new AudioContext()
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    const safeStart = Math.max(0, Math.min(start, decoded.duration))
    const safeEnd = Math.max(safeStart, Math.min(end, decoded.duration))
    const frameCount = Math.max(1, Math.floor((safeEnd - safeStart) * decoded.sampleRate))
    const offlineContext = new OfflineAudioContext(decoded.numberOfChannels, frameCount, decoded.sampleRate)
    const source = offlineContext.createBufferSource()
    source.buffer = decoded
    source.connect(offlineContext.destination)
    source.start(0, safeStart, Math.max(0.05, safeEnd - safeStart))
    const rendered = await offlineContext.startRendering()
    const wavBuffer = audioBufferToWav(rendered)
    return new File([wavBuffer], `${nextName || file.name.replace(/\.[^.]+$/, '')}.wav`, { type: 'audio/wav' })
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
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i))
  }
  writeString(0, 'RIFF'); view.setUint32(4, 36 + dataLength, true); writeString(8, 'WAVE')
  writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true); writeString(36, 'data'); view.setUint32(40, dataLength, true)
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

// ─── Components ─────────────────────────────────────────────────────────────

function AudioTrimmer({ audioFile, initialStart, initialEnd, onSave, onCancel }: { audioFile: File | null, initialStart: number, initialEnd: number, onSave: (s: number, e: number) => void, onCancel: () => void }) {
  const [start, setStart] = useState<number>(initialStart || 0)
  const [end, setEnd] = useState<number>(initialEnd || (initialStart + 10))
  const [startText, setStartText] = useState(() => formatAudioTime(initialStart || 0))
  const [endText, setEndText] = useState(() => formatAudioTime(initialEnd || (initialStart + 10)))
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile); setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [audioFile])

  const handleAdjustStart = (offset: number) => {
    setStart((v) => {
      const next = Math.max(0, v + offset); setStartText(formatAudioTime(next))
      if (audioRef.current) { audioRef.current.currentTime = next; audioRef.current.play().catch(() => {}) }
      return next
    })
  }
  const handleAdjustEnd = (offset: number) => {
    setEnd((v) => {
      const next = Math.max(0, v + offset); setEndText(formatAudioTime(next))
      if (audioRef.current) { audioRef.current.currentTime = next; audioRef.current.play().catch(() => {}) }
      return next
    })
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      {objectUrl && <audio ref={audioRef} src={objectUrl} controls className="h-10 w-full" />}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-bold text-slate-500">Bắt đầu (mm:ss)</label>
          <div className="flex items-center gap-2">
            <input type="text" value={startText} onChange={e => setStartText(e.target.value)} onBlur={() => setStart(parseAudioTime(startText, start))} className="w-20 rounded-lg border px-3 py-1.5 text-sm font-mono" />
            <button onClick={() => handleAdjustStart(-1)} className="rounded bg-slate-200 px-2 py-1.5 text-xs">-1s</button>
            <button onClick={() => handleAdjustStart(1)} className="rounded bg-slate-200 px-2 py-1.5 text-xs">+1s</button>
          </div>
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-bold text-slate-500">Kết thúc (mm:ss)</label>
          <div className="flex items-center gap-2">
            <input type="text" value={endText} onChange={e => setEndText(e.target.value)} onBlur={() => setEnd(parseAudioTime(endText, end))} className="w-20 rounded-lg border px-3 py-1.5 text-sm font-mono" />
            <button onClick={() => handleAdjustEnd(-1)} className="rounded bg-slate-200 px-2 py-1.5 text-xs">-1s</button>
            <button onClick={() => handleAdjustEnd(1)} className="rounded bg-slate-200 px-2 py-1.5 text-xs">+1s</button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t pt-2">
        <button onClick={() => onSave(start, end)} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2 text-sm font-bold text-white"><Scissors className="h-4 w-4" /> Lưu & Trích xuất</button>
        <button onClick={onCancel} className="px-4 py-2 text-sm font-bold bg-slate-100 rounded-xl">Hủy</button>
      </div>
    </div>
  )
}

function AudioDropZone({ question, onUpload, onEdit }: { question: LocalQuestion, onUpload: (f: File) => void, onEdit: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const objectUrl = question.audioFile ? URL.createObjectURL(question.audioFile) : null

  if (question.audioUploading) return (
    <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 flex flex-col items-center gap-3 bg-blue-50">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" /><p className="text-sm font-medium text-blue-600">Đang xử lý...</p>
    </div>
  )

  if (question.audio_clip_url || objectUrl) {
    const source = question.audio_clip_url || objectUrl || ''
    return (
      <div className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><Headphones className="w-5 h-5 text-white" /></div>
          <div className="flex-1 min-w-0">
            <audio ref={audioRef} src={source} onEnded={() => setPlaying(false)} onTimeUpdate={() => setProgress(audioRef.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} className="hidden" />
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={duration || 1} step={0.01} value={progress} onChange={e => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value) }} className="w-full accent-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">{formatAudioTime(progress)} / {formatAudioTime(duration)}</span>
            </div>
          </div>
          <button onClick={() => { if (playing) audioRef.current?.pause(); else audioRef.current?.play(); setPlaying(!playing) }} className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white">
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="flex gap-2">
            <button onClick={onEdit} className="p-2 border rounded-lg bg-white"><Scissors className="h-4 w-4" /></button>
            <button onClick={() => inputRef.current?.click()} className="p-2 border rounded-lg bg-white text-emerald-600"><Upload className="h-4 w-4" /></button>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
      </div>
    )
  }

  return (
    <div onClick={() => inputRef.current?.click()} className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:bg-blue-50 transition-all">
      <Upload className="w-6 h-6 text-blue-500" />
      <p className="text-sm font-medium text-slate-700"><span className="text-blue-600">Click để tải lên</span> hoặc kéo thả audio</p>
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
    </div>
  )
}

// ─── Step Indicator ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ['Cấu hình', 'Biên tập nội dung', 'Xem lại & Xuất']
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1; const done = step > idx; const active = step === idx
        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all
                ${done || active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-400'}`}>
                {done ? <Check className="w-4 h-4" /> : idx}
              </div>
              <span className={`mt-1.5 text-xs font-medium ${active ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-24 h-0.5 mx-2 -mt-5 ${step > idx ? 'bg-blue-600' : 'bg-slate-200'}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Config ─────────────────────────────────────────────────────────

function Step1({ level, setLevel, title, setTitle, description, setDescription, timeLimit, setTimeLimit, mondai, setMondai, onNext, loading }: any) {
  const totalQ = mondai.filter((m: any) => m.enabled).reduce((s: number, m: any) => s + m.count, 0)
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Cấp độ JLPT</label>
        <div className="flex gap-2">
          {LEVELS.map(l => (
            <button key={l} onClick={() => setLevel(l)} className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${level === l ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Tiêu đề bài nghe</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Luyện nghe N2 – Tháng 12/2025" className="w-full px-3 py-2.5 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Thời gian (Phút)</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setTimeLimit(Math.max(0, timeLimit - 5))} className="w-9 h-9 rounded-lg border flex items-center justify-center"><Minus className="w-4 h-4" /></button>
            <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} className="w-16 text-center font-bold border-b" />
            <button onClick={() => setTimeLimit(timeLimit + 5)} className="w-9 h-9 rounded-lg border flex items-center justify-center"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Cấu hình Mondai</label>
        <div className="space-y-2">
          {mondai.map((m: any) => (
            <div key={m.id} className={`flex items-center justify-between p-4 rounded-xl border ${m.enabled ? 'border-blue-200 bg-blue-50/40' : 'bg-slate-50 opacity-60'}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => setMondai(mondai.map((x: any) => x.id === m.id ? { ...x, enabled: !x.enabled } : x))} className={`w-5 h-5 rounded border-2 flex items-center justify-center ${m.enabled ? 'bg-blue-600 border-blue-600' : 'bg-white'}`}>{m.enabled && <Check className="w-3 h-3 text-white" />}</button>
                <div><p className="text-sm font-semibold">{m.label}</p><p className="text-xs text-slate-500">{m.nameJa}</p></div>
              </div>
              {m.enabled && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setMondai(mondai.map((x: any) => x.id === m.id ? { ...x, count: Math.max(0, x.count - 1) } : x))} className="w-7 h-7 rounded border bg-white">-</button>
                  <span className="w-8 text-center font-bold">{m.count}</span>
                  <button onClick={() => setMondai(mondai.map((x: any) => x.id === m.id ? { ...x, count: x.count + 1 } : x))} className="w-7 h-7 rounded border bg-white">+</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button onClick={onNext} disabled={!title.trim() || loading} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Tiếp tục <ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Editor ─────────────────────────────────────────────────────────

function Step2({ questions, examId, onQuestionsChange, onBack }: { questions: LocalQuestion[], examId: string, onQuestionsChange: (qs: LocalQuestion[]) => void, onBack: () => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isEditingAudio, setIsEditingAudio] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const q = questions[selectedIdx]
  const savedCount = questions.filter(q => q.saved).length
  
  const groupedQuestions = Array.from(
    questions.reduce((map, question, index) => {
      const bucket = map.get(question.mondai_group) || []
      bucket.push({ question, index })
      map.set(question.mondai_group, bucket)
      return map
    }, new Map<string, Array<{ question: LocalQuestion; index: number }>>())
  ).sort(([a], [b]) => extractMondaiNumber(a) - extractMondaiNumber(b))

  const updateQ = (patch: Partial<LocalQuestion>) => {
    onQuestionsChange(questions.map((item, i) => i === selectedIdx ? { ...item, ...patch } : item))
  }

  const handleAudioUpload = (file: File) => {
    updateQ({ audioFile: file, audio_name: file.name.replace(/\.[^.]+$/, ''), audio_clip_url: undefined, saved: false, audio_trim_start: 0, audio_trim_end: 10 })
  }

  const handleSaveAudioTrim = async (start: number, end: number) => {
    if (!q.audioFile) return
    try {
      const trimmedFile = await trimAudioFile(q.audioFile, start, end, q.audio_name || 'trimmed_audio')
      updateQ({ audioFile: trimmedFile, audio_trim_start: 0, audio_trim_end: end - start, saved: false })
      setIsEditingAudio(false)
      toast({ title: 'Đã cắt audio' })
    } catch (e: any) { setError(e.message) }
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      let qId = q.question_id
      if (!qId) {
        const res = await examClient.createQuestion({
          exam_id: examId, mondai_group: q.mondai_group, question_number: q.question_number,
          question_text: q.question_text, explanation: q.script_text, difficulty: q.difficulty,
          answers: q.answers.map(a => ({ question_id: '', content: a.content, is_correct: a.is_correct, order_index: a.order_index }))
        })
        qId = res.question_id
        updateQ({ question_id: qId, saved: true, answers: q.answers.map((a, i) => ({ ...a, answer_id: res.answers[i]?.answer_id })) })
      } else {
        await examClient.updateQuestion(qId, { question_text: q.question_text, explanation: q.script_text, difficulty: q.difficulty })
        for (const a of q.answers) if (a.answer_id) await examClient.updateAnswer(a.answer_id, { content: a.content, is_correct: a.is_correct })
        updateQ({ saved: true })
      }
      if (q.audioFile && !q.audio_clip_url && qId) {
        updateQ({ audioUploading: true })
        const res = await examClient.uploadQuestionAudio(qId, q.audioFile)
        updateQ({ audio_clip_url: res.audio_clip_url, audioUploading: false })
      }
      if (q.image_file && qId) {
        const res = await examClient.uploadQuestionImage(qId, q.image_file)
        updateQ({ image_url: res.image_url, image_file: undefined })
      }
      if (selectedIdx < questions.length - 1) setSelectedIdx(selectedIdx + 1)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  if (!q) return <div className="p-20 text-center">Không có câu hỏi.</div>

  return (
    <div className="flex gap-4 h-[calc(100vh-320px)] min-h-[550px]">
      {/* Sidebar - Modern Dark Style */}
      <div className="w-72 shrink-0 border rounded-xl bg-[#0f172a] text-white overflow-y-auto">
        <div className="p-5 border-b border-slate-700 sticky top-0 bg-[#1e293b] z-10">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Danh sách câu hỏi</p>
          <p className="text-xs text-blue-400 font-medium mt-1">{savedCount}/{questions.length} Hoàn thành</p>
        </div>
        {groupedQuestions.map(([group, groupQs]) => (
          <div key={group} className="p-4 border-b border-slate-800">
            <p className="text-sm font-bold mb-3">{group}</p>
            <div className="flex flex-wrap gap-2">
              {groupQs.map(({ index }) => (
                <button key={index} onClick={() => setSelectedIdx(index)} className={`w-10 h-10 rounded-full border-2 font-bold text-sm transition-all ${index === selectedIdx ? 'border-blue-500 bg-blue-500/20 text-blue-400' : questions[index].saved ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 text-slate-400'}`}>
                  {questions[index].question_number}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Editor Main */}
      <div className="flex-1 border rounded-xl bg-white flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div><p className="text-xs text-slate-400 font-bold uppercase">{q.mondai_group}</p><h2 className="text-lg font-bold">Câu hỏi số {q.question_number}</h2></div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-lg border">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => updateQ({ difficulty: s })} className={`p-1.5 ${q.difficulty! >= s ? 'text-amber-400' : 'text-slate-300'}`}><Star className="w-4 h-4 fill-current" /></button>
              ))}
            </div>
            <button onClick={() => { if(confirm('Xoá?')) { onQuestionsChange(questions.filter((_, i) => i !== selectedIdx)); setSelectedIdx(0) } }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Audio Section */}
          <div className="space-y-3">
            <label className="text-sm font-bold flex items-center gap-2"><Headphones className="w-4 h-4" /> Audio bài nghe</label>
            {isEditingAudio ? <AudioTrimmer audioFile={q.audioFile || null} initialStart={q.audio_trim_start || 0} initialEnd={q.audio_trim_end || 10} onSave={handleSaveAudioTrim} onCancel={() => setIsEditingAudio(false)} /> : <AudioDropZone question={q} onUpload={handleAudioUpload} onEdit={() => setIsEditingAudio(true)} />}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">Nội dung câu hỏi (Câu hỏi được đọc)</label>
              <textarea value={q.question_text} onChange={e => updateQ({ question_text: e.target.value })} rows={3} className="w-full p-3 border rounded-lg text-sm resize-none" placeholder="Ví dụ: 男の人はこれから何をしますか。" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">Script bài nghe (Hiển thị khi xem lại)</label>
              <textarea value={q.script_text} onChange={e => updateQ({ script_text: e.target.value })} rows={3} className="w-full p-3 border rounded-lg text-sm resize-none" placeholder="Nhập kịch bản tiếng Nhật..." />
            </div>
          </div>

          {/* Answers Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center"><label className="text-sm font-bold">Các lựa chọn đáp án</label><div className="flex gap-2">{[3,4].map(c => <button key={c} onClick={() => updateQ({ answers: Array.from({length: c}, (_, i) => q.answers[i] || { id: makeId(), content: '', is_correct: false, order_index: i }) })} className={`px-3 py-1 text-xs rounded border ${q.answers.length === c ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>{c} đáp án</button>)}</div></div>
            <div className="grid grid-cols-2 gap-3">
              {q.answers.map((ans, i) => (
                <div key={ans.id} className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${ans.is_correct ? 'border-blue-500 bg-blue-50' : 'bg-slate-50'}`}>
                  <button onClick={() => updateQ({ answers: q.answers.map(a => ({ ...a, is_correct: a.id === ans.id })) })} className={`w-5 h-5 rounded-full border-2 shrink-0 ${ans.is_correct ? 'bg-blue-600 border-blue-600' : 'bg-white'}`} />
                  <span className="font-bold text-slate-400">{String.fromCharCode(65+i)}.</span>
                  <input value={ans.content} onChange={e => updateQ({ answers: q.answers.map(a => a.id === ans.id ? { ...a, content: e.target.value } : a) })} className="bg-transparent w-full text-sm outline-none" placeholder="Nhập đáp án..." />
                </div>
              ))}
            </div>
          </div>

          {/* Image Section */}
          <div className="space-y-3">
             <label className="text-sm font-bold flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Hình ảnh minh họa (nếu có)</label>
             {q.image_url && <img src={q.image_url} className="max-h-48 rounded-lg border object-contain" alt="Preview" />}
             <div onClick={() => imageInputRef.current?.click()} className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50"><p className="text-sm text-slate-500">Dán link ảnh hoặc <span className="text-blue-600 font-bold">click để upload</span></p></div>
             <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f) updateQ({ image_file: f, image_url: URL.createObjectURL(f) }) }} />
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <p className="text-xs text-red-500">{error}</p>
          <div className="flex gap-3">
            <button onClick={onBack} className="px-4 py-2 text-sm font-bold text-slate-600">Quay lại</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Lưu câu hỏi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Review ─────────────────────────────────────────────────────────

function Step3({ questions, examTitle, onBack, onPublish, publishing }: any) {
  const savedCount = questions.filter((q: any) => q.saved).length
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <h3 className="text-xl font-bold">{examTitle}</h3>
        <p className="text-sm opacity-90 mt-1">Trạng thái: Hoàn thành {savedCount}/{questions.length} câu hỏi</p>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
         <table className="w-full text-left text-sm">
           <thead className="bg-slate-50 border-b">
             <tr><th className="p-4 font-bold">Mondai</th><th className="p-4 font-bold">Câu số</th><th className="p-4 font-bold">Nội dung</th><th className="p-4 font-bold text-center">Trạng thái</th></tr>
           </thead>
           <tbody>
             {questions.map((q: any, i: number) => (
               <tr key={i} className="border-b hover:bg-slate-50/50">
                 <td className="p-4 font-medium text-slate-600">{q.mondai_group}</td>
                 <td className="p-4 font-bold"># {q.question_number}</td>
                 <td className="p-4 text-slate-500 truncate max-w-xs">{q.question_text || '(Chưa có nội dung)'}</td>
                 <td className="p-4 text-center">{q.saved ? <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-bold">Đã lưu</span> : <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs font-bold">Chưa lưu</span>}</td>
               </tr>
             ))}
           </tbody>
         </table>
      </div>
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 font-bold"><ChevronLeft className="w-4 h-4" /> Quay lại biên tập</button>
        <button onClick={onPublish} disabled={publishing || savedCount === 0} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2">
          {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Xuất bản đề thi ngay
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CreateExamPage() {
  const navigate = useNavigate()
  const [level, setLevel] = useState<Level>('N2')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [timeLimit, setTimeLimit] = useState(50)
  const [mondai, setMondai] = useState<MondaiConfig[]>(DEFAULT_MONDAI)
  const [examId, setExamId] = useState('')
  const [questions, setQuestions] = useState<LocalQuestion[]>([])
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const handleStep1Next = async () => {
    setLoading(true)
    try {
      const exam = await examClient.createExam({ title: `[${level}] ${title}`, description, time_limit: timeLimit })
      setExamId(exam.exam_id)
      setQuestions(sortQuestions(buildLocalQuestions(mondai)))
      setStep(2)
    } catch (e: any) { toast({ title: 'Lỗi', description: e.message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      await examClient.updateExam(examId, { is_published: true, current_step: 3 })
      toast({ title: 'Thành công! 🎉', description: 'Đề thi đã được xuất bản.' })
      navigate('/exam')
    } catch (e: any) { toast({ title: 'Lỗi', description: e.message, variant: 'destructive' }) }
    finally { setPublishing(false) }
  }

  return (
    <div className="mx-auto max-w-[1400px] p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Tạo đề thi thủ công</h1>
        <p className="text-slate-500 mt-1 font-medium">Quy trình biên tập nội dung bài thi JLPT chuyên nghiệp</p>
      </div>

      <div className="bg-white border shadow-xl shadow-slate-200/50 rounded-3xl p-8">
        <StepIndicator step={step} />
        {step === 1 && <Step1 level={level} setLevel={setLevel} title={title} setTitle={setTitle} description={description} setDescription={setDescription} timeLimit={timeLimit} setTimeLimit={setTimeLimit} mondai={mondai} setMondai={setMondai} onNext={handleStep1Next} loading={loading} />}
        {step === 2 && <Step2 questions={questions} examId={examId} onQuestionsChange={setQuestions} onBack={() => setStep(1)} />}
        {step === 3 && <Step3 questions={questions} examTitle={`[${level}] ${title}`} onBack={() => setStep(2)} onPublish={handlePublish} publishing={publishing} />}
      </div>

      {step === 2 && (
        <div className="flex justify-end mt-6">
          <button onClick={() => setStep(3)} className="flex items-center gap-2 px-8 py-3 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all shadow-lg">Tiếp tục xem lại <ChevronRight className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  )
}