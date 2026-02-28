import { useEffect, useState, useRef } from 'react'
import {
  X, Headphones, Check, Clock, BookOpen, Layers, Play, Pause, Loader2, Edit2, Trash2, Save
} from 'lucide-react'
import { examClient, ExamResponse, QuestionResponse } from './api/examClient'
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

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={() => {
          if (!audioRef.current) return
          if (playing) { audioRef.current.pause(); setPlaying(false) }
          else { audioRef.current.play(); setPlaying(true) }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
      >
        {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        {playing ? 'Dừng' : 'Nghe audio'}
      </button>
      <audio
        ref={audioRef}
        src={url}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  )
}

export default function ExamDetailModal({ exam, onClose, onExamDeleted, onExamUpdated }: Props) {
  const [questions, setQuestions] = useState<QuestionResponse[]>([])
  const [loading, setLoading] = useState(true)

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(exam.title)
  const [editTimeLimit, setEditTimeLimit] = useState(exam.time_limit || 0)
  const [editIsPublished, setEditIsPublished] = useState(exam.is_published)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    examClient.getExamQuestions(exam.exam_id)
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false))
  }, [exam.exam_id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await examClient.updateExam(exam.exam_id, {
        title: editTitle,
        time_limit: editTimeLimit,
        is_published: editIsPublished
      })
      toast({ title: 'Đã cập nhật', description: 'Cập nhật đề thi thành công' })
      setIsEditing(false)
      if (onExamUpdated) onExamUpdated(updated)
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message || 'Cập nhật thất bại', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xoá đề thi này? Hành động này không thể hoàn tác.')) return
    setDeleting(true)
    try {
      await examClient.deleteExam(exam.exam_id)
      toast({ title: 'Đã xoá', description: 'Đề thi đã được xoá' })
      if (onExamDeleted) onExamDeleted()
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message || 'Xoá thất bại', variant: 'destructive' })
      setDeleting(false)
    }
  }

  const groups = Array.from(new Set(questions.map(q => q.mondai_group || 'Khác')))
  const totalQ = questions.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            {isEditing ? (
              <div className="mb-3 space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full text-lg font-bold px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="Tiêu đề đề thi"
                />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <input
                      type="number"
                      value={editTimeLimit}
                      onChange={e => setEditTimeLimit(parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <span className="text-sm text-slate-500">phút</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsPublished}
                      onChange={e => setEditIsPublished(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Xuất bản</span>
                  </label>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{exam.title}</h2>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    {totalQ} câu hỏi
                  </span>
                  {exam.time_limit && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {exam.time_limit} phút
                    </span>
                  )}
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                    ${exam.is_published
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                    {exam.is_published ? '✓ Đã xuất bản' : '⏳ Nháp'}
                  </span>
                </div>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-16">
              <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Đề thi này chưa có câu hỏi nào.</p>
            </div>
          ) : (
            groups.map(group => {
              const groupQs = questions.filter(q => (q.mondai_group || 'Khác') === group)
              return (
                <div key={group}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg">
                      {group}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{groupQs.length} câu</span>
                  </div>
                  <div className="space-y-4">
                    {groupQs.map((q, i) => (
                      <div
                        key={q.question_id}
                        className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/60"
                      >
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Câu {q.question_number ?? i + 1}
                        </p>
                        {q.question_text ? (
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{q.question_text}</p>
                        ) : (
                          <p className="text-sm italic text-slate-400 dark:text-slate-500">Chưa có nội dung</p>
                        )}

                        {/* Audio */}
                        {q.audio_clip_url && (
                          <div className="flex items-center gap-2 mt-2">
                            <Headphones className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                            <AudioPlayer url={q.audio_clip_url} />
                          </div>
                        )}

                        {/* Answers */}
                        {q.answers && q.answers.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            {q.answers.map((ans, ai) => (
                              <div
                                key={ans.answer_id}
                                className={`flex items-start gap-2 p-2.5 rounded-lg text-xs border transition-all
                                  ${ans.is_correct
                                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}
                              >
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5
                                  ${ans.is_correct
                                    ? 'border-emerald-500 bg-emerald-500'
                                    : 'border-slate-300 dark:border-slate-600'}`}>
                                  {ans.is_correct && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <span className={`leading-relaxed ${ans.is_correct
                                  ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                  : 'text-slate-600 dark:text-slate-400'}`}>
                                  {String.fromCharCode(65 + ai)}. {ans.content || <em className="text-slate-400">Trống</em>}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="mt-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                              <span className="font-semibold">Giải thích:</span> {q.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0 flex items-center justify-between">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Xoá đề thi
          </button>
          
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Lưu
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Chỉnh sửa
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Đóng
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
