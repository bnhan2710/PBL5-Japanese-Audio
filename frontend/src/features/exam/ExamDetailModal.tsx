import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Headphones, Clock, Layers, Loader2,
  Trash2, Save, Brain, AlertCircle, Play, Pause,
  Edit3, FileText, ChevronLeft, ExternalLink, Plus, Star, Scissors, Download
} from 'lucide-react'
import { examClient, ExamResponse, QuestionResponse, AnswerResponse } from './api/examClient'
import { toast } from '@/hooks/use-toast'

interface Props {
  exam: ExamResponse
  onClose: () => void
  onExamDeleted?: () => void
  onExamUpdated?: (exam: ExamResponse) => void
}

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  // Reset player state whenever the audio URL changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.load()   // force reload with new src
    }
    setPlaying(false)
    setProgress(0)
    setDuration(0)
  }, [url])

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play().catch(() => { }); setPlaying(true) }
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = t
    setProgress(t)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
        <button
          onClick={toggle}
          className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors shrink-0 shadow-sm shadow-blue-500/30"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={progress}
            onChange={handleSeek}
            className="w-full h-1.5 appearance-none rounded-full bg-slate-200 dark:bg-slate-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
            <span>{fmt(progress)}</span>
            <span>{duration > 0 ? fmt(duration) : '--:--'}</span>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={url}
          onEnded={() => { setPlaying(false); setProgress(0) }}
          onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onError={() => setPlaying(false)}
          preload="metadata"
          className="hidden"
        />
      </div>
    </div>
  )
}

// ─── Inline Audio Trimmer ─────────────────────────────────────────────────────

function InlineAudioTrimmer({
  initialUrl,
  onSave,
  onCancel
}: {
  initialUrl: string | null;
  onSave: (url: string) => void;
  onCancel: () => void;
}) {
  const getBaseUrl = () => {
    if (!initialUrl) return null;
    let base = initialUrl;
    base = base.replace(/so_[\d.]+,?/, '');
    base = base.replace(/eo_[\d.]+,?/, '');
    base = base.replace('upload//', 'upload/');
    return base;
  }

  const extractTime = (type: 'so' | 'eo') => {
    if (!initialUrl) return 0;
    const match = initialUrl.match(new RegExp(`${type}_([\\d.]+)`));
    return match ? parseFloat(match[1]) : 0;
  }

  const baseUrl = getBaseUrl();
  const initialStart = extractTime('so');
  const initialEnd = extractTime('eo') || (initialStart + 15);

  const [start, setStart] = useState<number>(initialStart);
  const [end, setEnd] = useState<number>(initialEnd);

  const formatTime = (secs: number) => {
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.floor(Math.max(0, secs) % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  const [startText, setStartText] = useState(() => formatTime(initialStart));
  const [endText, setEndText] = useState(() => formatTime(initialEnd));
  const audioRef = useRef<HTMLAudioElement>(null);

  const parseTime = (str: string, fallback: number) => {
    const p = str.split(':');
    if (p.length === 2) return (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0);
    if (p.length === 1) return parseInt(p[0]) || 0;
    return fallback;
  }

  const handleAdjustStart = (offset: number) => {
    setStart(v => {
      const next = Math.max(0, v + offset);
      setStartText(formatTime(next));
      if (audioRef.current) { audioRef.current.currentTime = next; audioRef.current.play().catch(()=>{}); }
      return next;
    });
  }

  const handleAdjustEnd = (offset: number) => {
    setEnd(v => {
      const next = Math.max(0, v + offset);
      setEndText(formatTime(next));
      if (audioRef.current) { audioRef.current.currentTime = next; audioRef.current.play().catch(()=>{}); }
      return next;
    });
  }

  const applyStart = () => {
    const s = parseTime(startText, start);
    setStart(s);
    setStartText(formatTime(s));
    if (audioRef.current) { audioRef.current.currentTime = s; audioRef.current.play().catch(()=>{}); }
  }

  const applyEnd = () => {
    const e = parseTime(endText, end);
    setEnd(e);
    setEndText(formatTime(e));
    if (audioRef.current) { audioRef.current.currentTime = e; audioRef.current.play().catch(()=>{}); }
  }

  const handleSave = () => {
    if (!baseUrl) {
      toast({ title: 'Lỗi', description: 'Audio gốc không hợp lệ', variant: 'destructive' });
      return;
    }
    let newUrl = baseUrl;
    if (newUrl.includes('cloudinary.com')) {
      newUrl = newUrl.replace('/upload/', `/upload/eo_${end},so_${start}/`);
    }
    onSave(newUrl);
  }

  return (
    <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 w-full mt-2">
      {baseUrl ? (
         <audio ref={audioRef} src={baseUrl} controls className="w-full h-10 outline-none" />
      ) : (
         <p className="text-sm text-slate-500">Đang tải audio...</p>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 w-full">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1"><Play className="w-3 h-3"/> Bắt đầu (mm:ss)</label>
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
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1"><Pause className="w-3 h-3"/> Kết thúc (mm:ss)</label>
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
        <button onClick={handleSave} className="flex-1 px-3 py-2 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:from-emerald-600 hover:to-teal-600 transition-colors shadow-sm">
          <Scissors className="w-4 h-4"/> Lưu & Trích xuất
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          Hủy
        </button>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function ExamDetailModal({ exam, onClose, onExamDeleted, onExamUpdated }: Props) {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<QuestionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [activeQId, setActiveQId] = useState<string | null>(null)

  // Exam header editing
  const [editTitle, setEditTitle] = useState(exam.title)
  const [editTimeLimit, setEditTimeLimit] = useState(exam.time_limit ?? 0)
  const [editIsPublished, setEditIsPublished] = useState(exam.is_published)
  const [headerDirty, setHeaderDirty] = useState(false)
  const [savingHeader, setSavingHeader] = useState(false)
  const [deletingExam, setDeletingExam] = useState(false)

  // Per-question editing state
  const [editedQuestions, setEditedQuestions] = useState<Record<string, Partial<QuestionResponse>>>({})
  const [savingQ, setSavingQ] = useState<string | null>(null)
  const [deletingQ, setDeletingQ] = useState<string | null>(null)
  const [confirmDeleteQ, setConfirmDeleteQ] = useState<string | null>(null)
  const [isEditingAudio, setIsEditingAudio] = useState<string | null>(null)

  const handleOpenPdfExport = () => {
    window.open(`/exam/${exam.exam_id}/pdf?autoprint=1`, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    examClient.getExamQuestions(exam.exam_id)
      .then(qs => { setQuestions(qs); if (qs.length > 0) setActiveQId(qs[0].question_id) })
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false))
  }, [exam.exam_id])

  // ── Header actions ──────────────────────────────────────────────────────────

  const handleSaveHeader = async () => {
    setSavingHeader(true)
    try {
      const updated = await examClient.updateExam(exam.exam_id, {
        title: editTitle,
        time_limit: editTimeLimit,
        is_published: editIsPublished,
      })
      toast({ title: 'Đã cập nhật thông tin đề thi' })
      setHeaderDirty(false)
      if (onExamUpdated) onExamUpdated(updated)
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' })
    } finally {
      setSavingHeader(false)
    }
  }

  const handleDeleteExam = async () => {
    if (!confirm('Xoá đề thi này? Hành động không thể hoàn tác.')) return
    setDeletingExam(true)
    try {
      await examClient.deleteExam(exam.exam_id)
      toast({ title: 'Đã xoá đề thi' })
      if (onExamDeleted) onExamDeleted()
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' })
      setDeletingExam(false)
    }
  }

  // ── Question editing helpers ────────────────────────────────────────────────

  const getEditQ = (q: QuestionResponse) => ({ ...q, ...(editedQuestions[q.question_id] ?? {}) })

  const patchQ = (qId: string, patch: Partial<QuestionResponse>) => {
    setEditedQuestions(prev => ({ ...prev, [qId]: { ...(prev[qId] ?? {}), ...patch } }))
  }

  const patchAnswer = (qId: string, aIdx: number, patch: Partial<AnswerResponse>) => {
    const q = questions.find(x => x.question_id === qId)!
    const base = editedQuestions[qId] ?? {}
    const answers = (base.answers ?? q.answers).map((a, i) => {
      if (patch.is_correct !== undefined) return { ...a, is_correct: i === aIdx }
      return i === aIdx ? { ...a, ...patch } : a
    })
    patchQ(qId, { answers })
  }

  const isDirtyQ = (qId: string) => !!editedQuestions[qId] && Object.keys(editedQuestions[qId]).length > 0

  const handleSaveQ = async (q: QuestionResponse) => {
    const patch = editedQuestions[q.question_id]
    if (!patch) return
    setSavingQ(q.question_id)
    try {
      const { answers: patchAnswers, ...questionPatch } = patch
      const updated = await examClient.updateQuestion(q.question_id, questionPatch)
      // Save answers if changed
      if (patchAnswers) {
        const removedAnswers = q.answers.filter(oa => !patchAnswers.find(pa => pa.answer_id === oa.answer_id))
        await Promise.all(removedAnswers.map(a => examClient.deleteAnswer(a.answer_id)))

        await Promise.all(
          patchAnswers.map((a, i) =>
            a.answer_id
              ? examClient.updateAnswer(a.answer_id, { content: a.content, is_correct: a.is_correct, order_index: i })
              : examClient.createAnswer({ question_id: q.question_id, content: a.content || '', is_correct: !!a.is_correct, order_index: i })
          )
        )
        const allQs = await examClient.getExamQuestions(exam.exam_id)
        const refreshedQ = allQs.find(x => x.question_id === q.question_id)
        setQuestions(prev => prev.map(x => x.question_id === q.question_id ? (refreshedQ || x) : x))
      } else {
        setQuestions(prev => prev.map(x => x.question_id === q.question_id ? { ...x, ...updated } : x))
      }
      setEditedQuestions(prev => { const n = { ...prev }; delete n[q.question_id]; return n })
      toast({ title: 'Đã lưu câu hỏi' })
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' })
    } finally {
      setSavingQ(null)
    }
  }

  const getBaseAudioUrl = (): string | null => {
    const clipUrl = questions.find(q => q.audio_clip_url)?.audio_clip_url
    if (!clipUrl) return null
    let base = clipUrl
    base = base.replace(/so_[\d.]+,?/, '')
    base = base.replace(/eo_[\d.]+,?/, '')
    base = base.replace('upload//', 'upload/')
    return base
  }

  const handleDeleteQ = async (qId: string) => {
    setDeletingQ(qId)
    try {
      await examClient.deleteQuestion(qId)
      const remaining = questions.filter(x => x.question_id !== qId)
      setQuestions(remaining)
      setActiveQId(remaining.length > 0 ? remaining[0].question_id : null)
      setConfirmDeleteQ(null)
      toast({ title: 'Đã xoá câu hỏi' })
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' })
    } finally {
      setDeletingQ(null)
    }
  }

  const handleAddQuestion = async (group: string) => {
    const questionsInGroup = questions.filter(q => q.mondai_group === group)
    const nums = questionsInGroup.map(q => q.question_number || 1).sort((a, b) => a - b)

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

    try {
      const newQ = await examClient.createQuestion({
        exam_id: exam.exam_id,
        mondai_group: group,
        question_number: nextNum,
        question_text: '',
        explanation: ''
      })

      const newAnswers = await Promise.all([0, 1, 2, 3].map(i =>
        examClient.createAnswer({
          question_id: newQ.question_id,
          content: '',
          is_correct: i === 0,
          order_index: i
        })
      ))

      const fullQ = { ...newQ, answers: newAnswers }

      setQuestions(prev => {
        const next = [...prev, fullQ]
        return next.sort((a, b) => {
          if (a.mondai_group !== b.mondai_group) return (a.mondai_group || '').localeCompare(b.mondai_group || '')
          return (a.question_number || 0) - (b.question_number || 0)
        })
      })
      setActiveQId(newQ.question_id)
      toast({ title: 'Đã thêm câu hỏi mới' })
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' })
    }
  }

  const updateAnswerCount = (qId: string, count: 3 | 4) => {
    const q = questions.find(x => x.question_id === qId)!
    const base = editedQuestions[qId] ?? {}
    const currentAnswers = base.answers ?? q.answers

    const nextAnswers = [...currentAnswers]
    while (nextAnswers.length > count) {
      nextAnswers.pop()
    }
    while (nextAnswers.length < count) {
      nextAnswers.push({ content: '', is_correct: false, answer_id: undefined } as any)
    }
    if (nextAnswers.length > 0 && !nextAnswers.some(a => a.is_correct)) {
      nextAnswers[0].is_correct = true
    }
    patchQ(qId, { answers: nextAnswers })
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const groupedQuestions = questions.reduce((acc, q) => {
    const g = q.mondai_group || 'Khác'
    if (!acc[g]) acc[g] = []
    acc[g].push(q)
    return acc
  }, {} as Record<string, QuestionResponse[]>)

  const activeQ = questions.find(q => q.question_id === activeQId)
  const activeEdited = activeQ ? getEditQ(activeQ) : null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <input
              value={editTitle}
              onChange={e => { setEditTitle(e.target.value); setHeaderDirty(true) }}
              className="w-full text-lg font-bold px-0 py-0 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-400 focus:outline-none text-slate-900 dark:text-slate-100 transition-colors"
              placeholder="Tiêu đề đề thi"
            />
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 font-medium">
                <Clock className="w-4 h-4 text-blue-500" />
                <input
                  type="number"
                  value={editTimeLimit}
                  onChange={e => { setEditTimeLimit(parseInt(e.target.value) || 0); setHeaderDirty(true) }}
                  className="w-14 text-center bg-transparent border-b border-slate-300 hover:border-slate-400 dark:border-slate-600 focus:border-blue-500 focus:outline-none text-sm transition-colors"
                />
                <span>phút</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsPublished}
                  onChange={e => { setEditIsPublished(e.target.checked); setHeaderDirty(true) }}
                  className="w-3.5 h-3.5 rounded accent-emerald-500"
                />
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                  ${editIsPublished
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                  {editIsPublished ? '✓ Xuất bản' : '⏳ Nháp'}
                </span>
              </label>

              {headerDirty && (
                <button
                  onClick={handleSaveHeader}
                  disabled={savingHeader}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60 shadow-sm"
                >
                  {savingHeader ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Lưu thay đổi
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenPdfExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Tải PDF
            </button>
            <button
              onClick={() => {
                onClose()
                navigate(`/test/exams/${exam.exam_id}`)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Làm bài thi
            </button>
            <button
              onClick={handleDeleteExam}
              disabled={deletingExam}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {deletingExam ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Xoá đề thi
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body: Split Pane ── */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : questions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Đề thi này chưa có câu hỏi nào.</p>
            </div>
          ) : (
            <>
              {/* Left Sidebar */}
              <div className="w-[260px] shrink-0 border-r border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                  <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Danh sách câu hỏi</h3>
                  <span className="text-[10px] font-bold bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                    {questions.length} câu
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {Object.entries(groupedQuestions).map(([group, qs]) => (
                    <div key={group}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">{group}</h4>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{qs.length} câu</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {qs.map(q => {
                          const isActive = activeQId === q.question_id
                          const hasAnswer = q.answers?.some(a => a.is_correct)
                          const dirty = isDirtyQ(q.question_id)
                          return (
                            <button
                              key={q.question_id}
                              onClick={() => setActiveQId(q.question_id)}
                              title={q.question_text || `Câu ${q.question_number}`}
                              className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200
                                ${isActive
                                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 shadow-sm'
                                  : hasAnswer
                                    ? 'border-emerald-500 text-emerald-600 bg-white dark:bg-slate-800 dark:border-emerald-600 dark:text-emerald-400 hover:bg-emerald-50'
                                    : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:bg-slate-800 hover:bg-slate-50'
                                }`}
                            >
                              {q.question_number ?? '?'}
                              {dirty && (
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 border-2 border-white dark:border-slate-800 rounded-full" />
                              )}
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
                    onClick={() => {
                      const newGroup = prompt('Nhập tên phần thi mới (ví dụ: Mondai 1):');
                      if (newGroup && newGroup.trim()) {
                        handleAddQuestion(newGroup.trim());
                      }
                    }}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" /> Thêm phần thi mới
                  </button>
                </div>
              </div>

              {/* Right Detail Pane */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {activeQ && activeEdited ? (
                  <>
                    {/* Pane Header */}
                    <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30 shrink-0">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-slate-500" />
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Hiệu đính chi tiết</h2>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 pl-2.5 pr-1 py-1 rounded-md flex items-center gap-1.5 border border-slate-200 dark:border-slate-600">
                            {activeQ.mondai_group}
                            <span className="text-slate-300 dark:text-slate-500 mx-0.5">-</span>
                            Câu
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => patchQ(activeQ.question_id, { question_number: Math.max(1, (activeEdited.question_number || 1) - 1) })} className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-300 font-bold select-none leading-none">-</button>
                              <span className="w-6 text-center">{activeEdited.question_number}</span>
                              <button onClick={() => patchQ(activeQ.question_id, { question_number: (activeEdited.question_number || 1) + 1 })} className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-600 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-300 font-bold select-none leading-none">+</button>
                            </div>
                          </span>
                        </div>
                        {isDirtyQ(activeQ.question_id) && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700">
                            Chưa lưu
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Delete Question */}
                        {confirmDeleteQ === activeQ.question_id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600 font-medium">Xác nhận xoá?</span>
                            <button
                              onClick={() => handleDeleteQ(activeQ.question_id)}
                              disabled={!!deletingQ}
                              className="px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                            >
                              {deletingQ === activeQ.question_id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Xoá'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteQ(null)}
                              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              Huỷ
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteQ(activeQ.question_id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Xoá câu hỏi
                          </button>
                        )}
                        {/* Save Question */}
                        {isDirtyQ(activeQ.question_id) && (
                          <button
                            onClick={() => handleSaveQ(activeQ)}
                            disabled={savingQ === activeQ.question_id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60 shadow-sm"
                          >
                            {savingQ === activeQ.question_id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Save className="w-3.5 h-3.5" />}
                            Lưu câu hỏi
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Pane Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">

                      {/* Difficulty Star Rating */}
                      <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-800 dark:text-slate-200">Độ khó (IRT Rating)</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => patchQ(activeQ.question_id, { difficulty: star })}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${(activeEdited.difficulty || 3) >= star ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'
                                }`}
                            >
                              <Star className={`w-5 h-5 ${(activeEdited.difficulty || 3) >= star ? 'fill-current' : ''}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Audio */}
                      <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Headphones className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">File âm thanh</span>
                        </div>
                        {isEditingAudio === activeQ.question_id ? (
                          <div className="mt-2">
                             <InlineAudioTrimmer
                               initialUrl={activeEdited.audio_clip_url || getBaseAudioUrl()}
                               onSave={(newUrl: string) => {
                                 patchQ(activeQ.question_id, { audio_clip_url: newUrl })
                                 setIsEditingAudio(null)
                               }}
                               onCancel={() => setIsEditingAudio(null)}
                             />
                          </div>
                        ) : activeEdited.audio_clip_url ? (
                           <div className="flex items-center gap-3 mt-2">
                             <div className="flex-1 min-w-0">
                               <AudioPlayer key={activeEdited.audio_clip_url} url={activeEdited.audio_clip_url} />
                             </div>
                             <button 
                               onClick={() => setIsEditingAudio(activeQ.question_id)} 
                               title="Chỉnh sửa thời gian lấy Audio"
                               className="w-[46px] h-[46px] shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shadow-sm border border-slate-200 dark:border-slate-700"
                             >
                               <Scissors className="w-4 h-4" />
                             </button>
                          </div>
                        ) : getBaseAudioUrl() ? (
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm text-slate-400 dark:text-slate-500 italic">Chưa lấy audio cho câu này từ file gốc</p>
                            <button onClick={() => setIsEditingAudio(activeQ.question_id)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium shrink-0 flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 mt-2">
                              <Scissors className="w-3.5 h-3.5" /> Lấy từ bản gốc
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 dark:text-slate-500 italic">Bài thi chưa có audio gốc để cắt</p>
                        )}
                      </div>

                      {/* Question Text: Script */}
                      <div>
                        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          Kịch bản hội thoại (Script)
                        </label>
                        <textarea
                          value={activeEdited.explanation ?? ''}
                          onChange={e => patchQ(activeQ.question_id, { explanation: e.target.value })}
                          rows={7}
                          placeholder="Kịch bản hội thoại, ví dụ: 男：...&#10;女：..."
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium leading-relaxed placeholder:text-slate-400 transition-shadow"
                        />
                      </div>

                      {/* Question Text: Content */}
                      <div>
                        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          Nội dung câu hỏi (Question)
                        </label>
                        <textarea
                          value={activeEdited.question_text ?? ''}
                          onChange={e => patchQ(activeQ.question_id, { question_text: e.target.value })}
                          rows={2}
                          placeholder="Nhập nội dung câu hỏi..."
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400 leading-relaxed transition-shadow"
                        />
                      </div>

                      {/* Answers */}
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                            Đáp án lựa chọn (Choices)
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Số đáp án</span>
                            {[3, 4].map((count) => {
                              const isActive = (activeEdited.answers ?? []).length === count;
                              return (
                                <button
                                  key={count}
                                  type="button"
                                  onClick={() => updateAnswerCount(activeQ.question_id, count as 3 | 4)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isActive
                                      ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                    }`}
                                >
                                  {count} đáp án
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {(activeEdited.answers ?? []).map((a, ai) => (
                            <div key={a.answer_id ?? ai} className="flex items-center gap-3 group/answer">
                              {/* Correct toggle */}
                              <button
                                onClick={() => patchAnswer(activeQ.question_id, ai, { is_correct: true })}
                                className="flex flex-col items-center w-10 shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                              >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                                  ${a.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                  {a.is_correct && <span className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                                {a.is_correct
                                  ? <span className="text-[9px] font-bold text-emerald-600 mt-0.5">Đúng</span>
                                  : <span className="text-[9px] font-medium text-slate-400 mt-0.5 opacity-0 group-hover/answer:opacity-100 transition-opacity">Chọn</span>
                                }
                              </button>
                              {/* Content */}
                              <div className={`flex-1 border rounded-xl px-4 py-2.5 transition-colors
                                ${a.is_correct
                                  ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-900/10'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'}`}>
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-bold shrink-0 ${a.is_correct ? 'text-emerald-500' : 'text-slate-400'}`}>
                                    {String.fromCharCode(65 + ai)}.
                                  </span>
                                  <input
                                    value={a.content ?? ''}
                                    onChange={e => patchAnswer(activeQ.question_id, ai, { content: e.target.value })}
                                    className="w-full text-sm bg-transparent border-0 outline-none text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400"
                                    placeholder="Nhập nội dung đáp án..."
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Pane Footer */}
                    <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0 flex justify-end gap-2 bg-slate-50/50 dark:bg-slate-800/30">
                      {isDirtyQ(activeQ.question_id) ? (
                        <>
                          <button
                            onClick={() => setEditedQuestions(prev => { const n = { ...prev }; delete n[activeQ.question_id]; return n })}
                            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />Hoàn tác
                          </button>
                          <button
                            onClick={() => handleSaveQ(activeQ)}
                            disabled={savingQ === activeQ.question_id}
                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60 shadow-sm"
                          >
                            {savingQ === activeQ.question_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Lưu câu hỏi
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Chỉnh sửa bất kỳ trường nào để kích hoạt nút lưu
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <Brain className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm text-slate-500 font-medium">Chọn một câu hỏi ở danh sách bên trái để hiệu đính</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
