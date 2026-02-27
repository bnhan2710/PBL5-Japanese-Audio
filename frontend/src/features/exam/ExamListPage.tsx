import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Clock, Layers, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { examClient, ExamResponse } from './api/examClient'
import ExamDetailModal from './ExamDetailModal'

// ─── Skeleton Card ───────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
      </div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
      <div className="flex gap-3">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
      </div>
    </div>
  )
}

// ─── Exam Card ───────────────────────────────────────────────────────────────
interface ExamCardProps {
  exam: ExamResponse
  onClick: () => void
}

function ExamCard({ exam, onClick }: ExamCardProps) {
  const date = new Date(exam.created_at).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <button
      onClick={onClick}
      className="group text-left w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md dark:hover:shadow-none transition-all"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
          {exam.title}
        </h3>
        <span className={`flex items-center gap-1 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full
          ${exam.is_published
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
          {exam.is_published
            ? <><CheckCircle2 className="w-3 h-3" /> Xuất bản</>
            : <><AlertCircle className="w-3 h-3" /> Nháp</>}
        </span>
      </div>

      {/* Description */}
      {exam.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-1">{exam.description}</p>
      )}

      {/* Meta */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {exam.time_limit != null && (
          <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Clock className="w-3.5 h-3.5" />{exam.time_limit} phút
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
          <FileText className="w-3.5 h-3.5" />{date}
        </span>
      </div>
    </button>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ExamListPage() {
  const navigate = useNavigate()
  const [exams, setExams] = useState<ExamResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ExamResponse | null>(null)

  useEffect(() => {
    examClient.listExams()
      .then(data => setExams(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message || 'Không thể tải danh sách đề thi'))
      .finally(() => setLoading(false))
  }, [])

  const published = exams.filter(e => e.is_published)
  const drafts = exams.filter(e => !e.is_published)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Đề thi của tôi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý và xem lại toàn bộ đề thi bạn đã tạo
          </p>
        </div>
        <button
          onClick={() => navigate('/exam/create')}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Tạo đề thi mới
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : exams.length === 0 ? (
        /* Empty state */
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Chưa có đề thi nào
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Hãy tạo đề thi đầu tiên của bạn ngay bây giờ.
          </p>
          <button
            onClick={() => navigate('/exam/create')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Tạo đề thi mới
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Published */}
          {published.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Đã xuất bản
                </h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">({published.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {published.map(exam => (
                  <ExamCard key={exam.exam_id} exam={exam} onClick={() => setSelected(exam)} />
                ))}
              </div>
            </section>
          )}

          {/* Drafts */}
          {drafts.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Bản nháp
                </h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">({drafts.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {drafts.map(exam => (
                  <ExamCard key={exam.exam_id} exam={exam} onClick={() => setSelected(exam)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <ExamDetailModal exam={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
