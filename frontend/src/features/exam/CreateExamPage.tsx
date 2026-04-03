import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, ChevronLeft, Check, Headphones, Plus, Minus,
  Upload, Trash2, Play, Pause, Loader2, CheckCircle2,
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
  id: string          // temp client id
  content: string
  image_url: string
  is_correct: boolean
  order_index: number
  answer_id?: string  // set after save
}

interface LocalQuestion {
  localId: string
  question_id?: string  // set after backend save
  mondai_group: string
  question_number: number
  audio_clip_url?: string
  audioFile?: File
  audioUploading?: boolean
  question_text: string
  script_text: string
  explanation: string
  answers: LocalAnswer[]
  saved: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

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
        answers: makeDefaultAnswers(),
        saved: false,
      })
    }
  }
  return qs
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
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all
                ${done ? 'bg-blue-600 border-blue-600 text-white'
                  : active ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-300 text-slate-400'}`}>
                {done ? <Check className="w-4 h-4" /> : idx}
              </div>
              <span className={`mt-1.5 text-xs whitespace-nowrap font-medium
                ${active ? 'text-blue-600' : done ? 'text-slate-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-24 h-0.5 mx-2 -mt-5 ${step > idx ? 'bg-blue-600' : 'bg-slate-200'}`} />
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
  timeLimit: number
  setTimeLimit: (n: number) => void
  mondai: MondaiConfig[]
  setMondai: (m: MondaiConfig[]) => void
  onNext: () => Promise<void>
  loading: boolean
}

function Step1({ level, setLevel, title, setTitle, timeLimit, setTimeLimit, mondai, setMondai, onNext, loading }: Step1Props) {
  const totalQ = mondai.filter(m => m.enabled).reduce((s, m) => s + m.count, 0)

  const toggle = (id: number) =>
    setMondai(mondai.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m))

  const adjust = (id: number, delta: number) =>
    setMondai(mondai.map(m => m.id === id ? { ...m, count: Math.max(0, m.count + delta) } : m))

  const handleManualCount = (id: number, val: string) => {
    const n = parseInt(val) || 0
    setMondai(mondai.map(m => m.id === id ? { ...m, count: Math.max(0, n) } : m))
  }

  return (
    <div className="space-y-6">
      {/* Level */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Cấp độ JLPT</label>
        <div className="flex gap-2">
          {LEVELS.map(l => (
            <button key={l} onClick={() => setLevel(l)}
              className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all
                ${level === l ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Time and title row */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Tiêu đề bài nghe</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Ví dụ: Luyện nghe N2 – Tháng 12/2025"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-400" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Thời gian làm bài (Phút)</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setTimeLimit(Math.max(0, timeLimit - 5))}
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              value={timeLimit}
              onChange={e => setTimeLimit(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 text-center text-xl font-bold bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={() => setTimeLimit(timeLimit + 5)}
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Tổng thời gian cho toàn bộ các phần thi bên dưới.</p>
        </div>
      </div>

      {/* Mondai config */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-slate-700">Cấu hình Mondai (Dạng bài tập)</label>
          <span className="text-xs text-slate-500">Tổng số câu hỏi: <span className="font-bold text-slate-700">{totalQ}</span></span>
        </div>
        <div className="space-y-2">
          {mondai.map(m => (
            <div key={m.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all
              ${m.enabled ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => toggle(m.id)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors
                    ${m.enabled ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                  {m.enabled && <Check className="w-3 h-3 text-white" />}
                </button>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                  <p className="text-xs text-slate-500">{m.nameJa}</p>
                </div>
              </div>
              {m.enabled && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 mr-1">Số câu:</span>
                  <button onClick={() => adjust(m.id, -1)}
                    className="w-7 h-7 rounded border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 text-slate-500">
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    value={m.count}
                    onChange={e => handleManualCount(m.id, e.target.value)}
                    className="w-10 text-center font-bold bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 outline-none text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => adjust(m.id, 1)}
                    className="w-7 h-7 rounded border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 text-slate-500">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={onNext} disabled={!title.trim() || loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Tiếp tục <ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  )
}

// ─── Audio Drop Zone ─────────────────────────────────────────────────────────

interface AudioZoneProps {
  question: LocalQuestion
  onUpload: (file: File) => void
}

function AudioDropZone({ question, onUpload }: AudioZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('audio/')) return
    onUpload(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  if (question.audioUploading) {
    return (
      <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 flex flex-col items-center gap-3 bg-blue-50">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm font-medium text-blue-600">Đang upload lên Cloudinary…</p>
      </div>
    )
  }

  if (question.audio_clip_url) {
    return (
      <div className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-700">Audio đã upload thành công</p>
            <audio ref={audioRef} src={question.audio_clip_url} onEnded={() => setPlaying(false)} className="hidden" />
            <p className="text-xs text-emerald-600 truncate mt-0.5">{question.audio_clip_url}</p>
          </div>
          <button onClick={() => {
            if (!audioRef.current) return
            if (playing) { audioRef.current.pause(); setPlaying(false) }
            else { audioRef.current.play(); setPlaying(true) }
          }} className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-600 transition-colors shrink-0">
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
        </div>
        <button onClick={() => inputRef.current?.click()}
          className="mt-3 text-xs text-emerald-600 hover:text-emerald-800 underline">
          ↩ Đổi file audio
        </button>
        <input ref={inputRef} type="file" accept="audio/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all
        ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'}`}>
      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
        <Upload className="w-6 h-6 text-blue-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700">
          <span className="text-blue-600">Click để tải lên</span> hoặc kéo thả file vào đây
        </p>
        <p className="text-xs text-slate-400 mt-1">Hỗ trợ MP3, WAV (Tối đa 50MB)</p>
      </div>
      <input ref={inputRef} type="file" accept="audio/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
    </div>
  )
}

// ─── Step 2: Edit Questions ──────────────────────────────────────────────────

interface Step2Props {
  questions: LocalQuestion[]
  examId: string
  onQuestionsChange: (qs: LocalQuestion[]) => void
  onBack: () => void
}

function Step2({ questions, examId, onQuestionsChange, onBack }: Step2Props) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const q = questions[selectedIdx]

  const updateQ = (patch: Partial<LocalQuestion>) => {
    onQuestionsChange(questions.map((item, i) => i === selectedIdx ? { ...item, ...patch } : item))
  }

  const updateAnswer = (answerId: string, patch: Partial<LocalAnswer>) => {
    updateQ({ answers: q.answers.map(a => a.id === answerId ? { ...a, ...patch } : a) })
  }

  const toggleCorrect = (answerId: string) => {
    updateQ({
      answers: q.answers.map(a => ({ ...a, is_correct: a.id === answerId }))
    })
  }

  const handleAudioUpload = async (file: File) => {
    if (!q.question_id) {
      setError('Hãy lưu câu hỏi trước khi upload audio.')
      return
    }
    updateQ({ audioFile: file, audioUploading: true })
    try {
      const res = await examClient.uploadQuestionAudio(q.question_id, file)
      updateQ({ audio_clip_url: res.audio_clip_url, audioUploading: false })
    } catch (e: any) {
      updateQ({ audioUploading: false })
      setError(e.message || 'Upload audio thất bại')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      let questionId = q.question_id

      if (!questionId) {
        const created = await examClient.createQuestion({
          exam_id: examId,
          mondai_group: q.mondai_group,
          question_number: q.question_number,
          question_text: q.question_text,
          explanation: q.explanation,
          answers: q.answers.map(a => ({
            question_id: '',
            content: a.content,
            image_url: a.image_url || undefined,
            is_correct: a.is_correct,
            order_index: a.order_index,
          })),
        })
        questionId = created.question_id
        const serverAnswers = created.answers
        updateQ({
          question_id: questionId,
          saved: true,
          answers: q.answers.map((a, i) => ({ ...a, answer_id: serverAnswers[i]?.answer_id })),
        })
      } else {
        await examClient.updateQuestion(questionId, {
          question_text: q.question_text,
          explanation: q.explanation,
        })
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

      if (q.audioFile && !q.audio_clip_url && questionId) {
        updateQ({ audioUploading: true })
        const audioRes = await examClient.uploadQuestionAudio(questionId, q.audioFile)
        updateQ({ audio_clip_url: audioRes.audio_clip_url, audioUploading: false, saved: true })
      }

      if (selectedIdx < questions.length - 1) setSelectedIdx(selectedIdx + 1)
    } catch (e: any) {
      setError(e.message || 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  const groups = Array.from(new Set(questions.map(q => q.mondai_group)))

  return (
    <div className="flex gap-4 h-[calc(100vh-260px)] min-h-[520px]">
      {/* Sidebar – light circular grid style */}
      <div className="w-56 shrink-0 rounded-xl overflow-y-auto flex flex-col bg-white border border-slate-200">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-100">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Danh sách câu hỏi</p>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{questions.length} câu</span>
        </div>

        {/* Groups */}
        <div className="flex-1 px-3 pt-3 pb-3 space-y-5">
          {groups.map(group => {
            const groupQs = questions.filter(q => q.mondai_group === group)
            const startIdx = questions.findIndex(q => q.mondai_group === group)
            return (
              <div key={group}>
                {/* Group header */}
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-semibold text-slate-700">{group}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">{groupQs.length} câu</span>
                </div>

                {/* Circular buttons grid */}
                <div className="grid grid-cols-4 gap-2">
                  {groupQs.map((qItem, localI) => {
                    const globalIdx = startIdx + localI
                    const isActive = globalIdx === selectedIdx
                    return (
                      <button
                        key={qItem.localId}
                        onClick={() => setSelectedIdx(globalIdx)}
                        title={`Câu ${qItem.question_number}`}
                        style={{
                          width: 40, height: 40,
                          borderRadius: '50%',
                          border: isActive ? '2px solid #2563eb' : qItem.saved ? '2px solid #10b981' : '2px solid #e2e8f0',
                          background: isActive ? '#2563eb' : qItem.saved ? '#d1fae5' : '#f8fafc',
                          color: isActive ? '#fff' : qItem.saved ? '#065f46' : '#64748b',
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          boxShadow: isActive ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
                        }}
                      >
                        {qItem.question_number}
                      </button>
                    )
                  })}
                  {/* Add question placeholder */}
                  <button
                    onClick={() => {
                      const m = DEFAULT_MONDAI.find(m => `Mondai ${m.id}` === group)
                      if (!m) return
                      const newQ: LocalQuestion = {
                        localId: makeId(),
                        mondai_group: group,
                        question_number: groupQs.length + 1,
                        question_text: '', script_text: '', explanation: '',
                        answers: makeDefaultAnswers(),
                        saved: false,
                      }
                      onQuestionsChange([...questions, newQ])
                      setSelectedIdx(startIdx + groupQs.length)
                    }}
                    title="Thêm câu hỏi"
                    style={{
                      width: 40, height: 40,
                      borderRadius: '50%',
                      border: '2px dashed #cbd5e1',
                      background: 'transparent',
                      color: '#94a3b8',
                      fontSize: 18,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2563eb'; (e.currentTarget as HTMLElement).style.color = '#2563eb' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer – add mondai */}
        <div className="px-3 pb-4 border-t border-slate-100 pt-3">
          <button
            style={{
              width: '100%', padding: '8px 0',
              borderRadius: 10,
              border: '2px dashed #cbd5e1',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2563eb'; (e.currentTarget as HTMLElement).style.color = '#2563eb' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
            title="Thêm phần thi mới (chưa khả dụng)"
          >
            + Thêm phần thi mới
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 border border-slate-200 rounded-xl bg-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Đang chỉnh sửa</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded">{q.mondai_group}</span>
              <h2 className="text-base font-bold text-slate-800">Câu hỏi số {q.question_number}</h2>
            </div>
          </div>
          <button onClick={() => {
            if (!confirm('Xoá câu hỏi này?')) return
            onQuestionsChange(questions.filter((_, i) => i !== selectedIdx))
            setSelectedIdx(Math.max(0, selectedIdx - 1))
          }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Xoá
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Audio */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Headphones className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-slate-700">File âm thanh (Audio)</p>
              {!q.question_id && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Lưu câu hỏi trước để upload audio</span>
              )}
            </div>
            <AudioDropZone question={q} onUpload={handleAudioUpload} />
          </div>

          {/* Script + Question text */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Script (Tiếng Nhật) <span className="text-slate-400 font-normal">– Hiển thị khi xem lại</span>
              </label>
              <textarea value={q.script_text}
                onChange={e => updateQ({ script_text: e.target.value })}
                rows={5}
                placeholder="Nhập nội dung hội thoại tiếng Nhật tại đây..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Nội dung câu hỏi <span className="text-slate-400 font-normal">– Câu hỏi được đọc cuối bài</span>
              </label>
              <textarea value={q.question_text}
                onChange={e => updateQ({ question_text: e.target.value })}
                rows={5}
                placeholder="Ví dụ: 男の人はこれから何をしますか。"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-400" />
            </div>
          </div>

          {/* Answers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">Đáp án lựa chọn</p>
              <p className="text-xs text-slate-400">Chọn đáp án đúng bằng cách tích vào ô tròn</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {q.answers.map((ans, ai) => (
                <div key={ans.id} className={`rounded-xl border p-4 transition-all
                  ${ans.is_correct ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => toggleCorrect(ans.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                        ${ans.is_correct ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                      {ans.is_correct && <span className="w-2 h-2 rounded-full bg-white" />}
                    </button>
                    <span className="text-xs font-bold text-slate-500 uppercase">Đáp án {String.fromCharCode(65 + ai)}</span>
                  </div>
                  <textarea value={ans.content}
                    onChange={e => updateAnswer(ans.id, { content: e.target.value })}
                    rows={2}
                    placeholder="Nhập nội dung đáp án..."
                    className="w-full text-sm border-0 bg-transparent resize-none focus:outline-none placeholder:text-slate-400 text-slate-700" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {!error && <p className="text-xs text-slate-400">Lần sửa cuối: {new Date().toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })} hôm nay</p>}
          <div className="flex items-center gap-3 ml-auto">
            <button onClick={onBack} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Quay lại
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
  const groups = Array.from(new Set(questions.map(q => q.mondai_group)))
  const savedCount = questions.filter(q => q.saved).length

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
        <h3 className="text-base font-bold text-slate-800">{examTitle}</h3>
        <p className="text-sm text-slate-500 mt-1">Đã hoàn thành: <span className="font-semibold text-blue-600">{savedCount}/{questions.length}</span> câu hỏi</p>
      </div>

      {groups.map(group => {
        const groupQs = questions.filter(q => q.mondai_group === group)
        return (
          <div key={group}>
            <h4 className="text-sm font-bold text-slate-700 mb-2">{group}</h4>
            <div className="space-y-2">
              {groupQs.map(q => (
                <div key={q.localId} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                  {q.saved
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    : <span className="w-5 h-5 rounded-full border-2 border-amber-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      Câu {q.question_number}: {q.question_text || <span className="italic text-slate-400">Chưa nhập nội dung</span>}
                    </p>
                  </div>
                  {q.audio_clip_url && (
                    <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                      <Headphones className="w-3 h-3" /> Audio
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-4 h-4" /> Quay lại biên tập
        </button>
        <button onClick={onPublish} disabled={publishing || savedCount === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Xuất bản đề thi
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
      const exam = await examClient.createExam({
        title: `[${level}] ${title}`,
        time_limit: timeLimit,
      })
      await examClient.updateExam(exam.exam_id, { current_step: 2 })
      setExamId(exam.exam_id)
      setQuestions(buildLocalQuestions(mondai))
      setStep(2)
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message || 'Không thể tạo đề, thử lại.', variant: 'destructive' })
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
      await examClient.updateExam(examId, { is_published: true, current_step: 3 })
      toast({ title: 'Xuất bản thành công! 🎉', description: 'Đề thi đã được xuất bản và sẵn sàng sử dụng.' })
      navigate('/exam')
    } catch (e: any) {
      toast({ title: 'Lỗi xuất bản', description: e.message || 'Xuất bản thất bại', variant: 'destructive' })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Tạo đề thi thủ công</h1>
        <p className="text-sm text-slate-500 mt-1">
          {step === 1 ? 'Thiết lập cấu trúc đề thi và tự biên tập nội dung câu hỏi'
          : step === 2 ? `Biên tập chi tiết nội dung từng câu hỏi cho đề thi ${level}`
          : 'Xem lại và xuất bản đề thi'}
        </p>
      </div>

      {/* Wizard card */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
        <StepIndicator step={step} />
        {step === 1 && (
          <Step1
            level={level} setLevel={setLevel}
            title={title} setTitle={setTitle}
            timeLimit={timeLimit} setTimeLimit={setTimeLimit}
            mondai={mondai} setMondai={setMondai}
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
          <button onClick={handleStep2Next}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors">
            Tiếp tục xem lại <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
