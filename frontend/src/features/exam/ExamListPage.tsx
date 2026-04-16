import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Clock, Layers, FileText, CheckCircle2, AlertCircle, Sparkles, Search, Filter, Calendar, Shuffle } from 'lucide-react'
import { examClient, ExamResponse } from './api/examClient'
import ExamDetailModal from './ExamDetailModal'

// ─── Skeleton Card ───────────────────────────────────────────────────────────
function SkeletonCard() {
 return (
 <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
 <div className="flex items-start justify-between mb-3">
 <div className="h-4 bg-muted rounded w-3/4" />
 <div className="h-5 w-16 bg-muted rounded-full" />
 </div>
 <div className="h-3 bg-muted rounded w-1/2 mb-4" />
 <div className="flex gap-3">
 <div className="h-3 bg-muted rounded w-20" />
 <div className="h-3 bg-muted rounded w-20" />
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
 const safeTitle = typeof exam.title === 'string' && exam.title.trim() ? exam.title : 'Đề chưa đặt tên'
 const date = new Date(exam.created_at || '').toLocaleDateString('vi-VN', {
 day: '2-digit', month: '2-digit', year: 'numeric',
 })

 return (
 <button
 onClick={onClick}
 className="group text-left w-full bg-card border border-border rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md dark:hover:shadow-none transition-all"
 >
 {/* Top row */}
 <div className="flex items-start justify-between gap-3 mb-2">
 <h3 className="text-sm font-semibold text-card-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
 {safeTitle}
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
 <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{exam.description}</p>
 )}

 {/* Meta */}
 <div className="flex items-center gap-4 mt-3 flex-wrap">
 {exam.time_limit != null && (
 <span className="flex items-center gap-1 text-xs text-muted-foreground">
 <Clock className="w-3.5 h-3.5" />{exam.time_limit} phút
 </span>
 )}
 <span className="flex items-center gap-1 text-xs text-muted-foreground">
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

 const [searchQuery, setSearchQuery] = useState('')
 const [levelFilter, setLevelFilter] = useState('all')
 const [dateFilter, setDateFilter] = useState('all')

 const fetchExams = () => {
 setLoading(true)
 examClient.listExams(true)
 .then(data => {
 const normalized = Array.isArray(data)
 ? data
 .filter((item): item is ExamResponse => !!item && typeof item === 'object')
 .map((item) => ({
 ...item,
 title: typeof item.title === 'string' ? item.title : '',
 created_at: typeof item.created_at === 'string' ? item.created_at : '',
 }))
 : []
 setExams(normalized)
 })
 .catch(e => setError(e.message || 'Không thể tải danh sách đề thi'))
 .finally(() => setLoading(false))
 }

 useEffect(() => {
 fetchExams()
 }, [])

 const filteredExams = exams.filter(exam => {
 const safeTitle = typeof exam.title === 'string' ? exam.title : ''
 const safeCreatedAt = typeof exam.created_at === 'string' ? exam.created_at : ''

 if (searchQuery && !safeTitle.toLowerCase().includes(searchQuery.toLowerCase())) {
 return false
 }
 if (levelFilter !== 'all' && !safeTitle.includes(levelFilter)) {
 return false
 }
 
 if (dateFilter !== 'all') {
 const examDate = new Date(safeCreatedAt)
 if (Number.isNaN(examDate.getTime())) return false
 const now = new Date()
 if (dateFilter === 'today') {
 if (examDate.toDateString() !== now.toDateString()) return false
 } else if (dateFilter === 'week') {
 const weekAgo = new Date()
 weekAgo.setDate(now.getDate() - 7)
 if (examDate < weekAgo) return false
 } else if (dateFilter === 'month') {
 const monthAgo = new Date()
 monthAgo.setMonth(now.getMonth() - 1)
 if (examDate < monthAgo) return false
 }
 }
 
 return true
 })

 const published = filteredExams.filter(e => e.is_published)
 const drafts = filteredExams.filter(e => !e.is_published)

 return (
 <div className="p-8 max-w-6xl mx-auto">
 {/* Header */}
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-2xl font-bold text-card-foreground">Đề thi của tôi</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Quản lý và xem lại toàn bộ đề thi bạn đã tạo
 </p>
 </div>
 {!loading && exams.length > 0 && (
 <div className="flex items-center gap-3">
 <button
 onClick={() => navigate('/exam/ai-create')}
 className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-sm font-semibold hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/30"
 >
 <Sparkles className="w-4 h-4" />
 Tạo bằng AI
 </button>
 <button
 onClick={() => navigate('/exam/random-create')}
 className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/30"
 >
 <Shuffle className="w-4 h-4" />
 Sinh ngẫu nhiên
 </button>
 <button
 onClick={() => navigate('/exam/create')}
 className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
 >
 <Plus className="w-4 h-4" />
 Tạo thủ công
 </button>
 </div>
 )}
 </div>

 {/* Filters & Search */}
 {!loading && exams.length > 0 && (
 <div className="flex flex-col md:flex-row gap-4 mb-8 bg-card p-4 rounded-xl border border-border shadow-sm">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <input
 type="text"
 placeholder="Tìm kiếm đề thi..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-9 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-muted-foreground"
 />
 </div>
 
 <div className="flex items-center gap-3">
 <div className="relative">
 <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
 <select
 value={levelFilter}
 onChange={(e) => setLevelFilter(e.target.value)}
 className="appearance-none pl-9 pr-8 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-muted-foreground min-w-[130px] cursor-pointer"
 >
 <option value="all">Mọi cấp độ</option>
 <option value="N1">N1</option>
 <option value="N2">N2</option>
 <option value="N3">N3</option>
 <option value="N4">N4</option>
 <option value="N5">N5</option>
 </select>
 </div>

 <div className="relative">
 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
 <select
 value={dateFilter}
 onChange={(e) => setDateFilter(e.target.value)}
 className="appearance-none pl-9 pr-8 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-muted-foreground min-w-[130px] cursor-pointer"
 >
 <option value="all">Mọi lúc</option>
 <option value="today">Hôm nay</option>
 <option value="week">Tuần này</option>
 <option value="month">Tháng này</option>
 </select>
 </div>
 </div>
 </div>
 )}

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
 <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
 <Layers className="w-8 h-8 text-muted-foreground" />
 </div>
 <h2 className="text-base font-semibold text-slate-700 dark:text-muted-foreground mb-1">
 Chưa có đề thi nào
 </h2>
 <p className="text-sm text-muted-foreground mb-6">
 Hãy tạo đề thi đầu tiên của bạn ngay bây giờ.
 </p>
 <div className="flex items-center gap-3">
 <button
 onClick={() => navigate('/exam/ai-create')}
 className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-sm font-semibold hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/30"
 >
 <Sparkles className="w-4 h-4" /> Tạo bằng AI
 </button>
 <button
 onClick={() => navigate('/exam/random-create')}
 className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/30"
 >
 <Shuffle className="w-4 h-4" /> Sinh ngẫu nhiên
 </button>
 <button
 onClick={() => navigate('/exam/create')}
 className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
 >
 <Plus className="w-4 h-4" /> Tạo thủ công
 </button>
 </div>
 </div>
 ) : filteredExams.length === 0 && exams.length > 0 ? (
 <div className="text-center py-24">
 <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
 <Search className="w-8 h-8 text-muted-foreground" />
 </div>
 <h2 className="text-base font-semibold text-slate-700 dark:text-muted-foreground mb-1">
 Không tìm thấy đề thi
 </h2>
 <p className="text-sm text-muted-foreground">
 Hãy thử thay đổi từ khóa hoặc bộ lọc của bạn.
 </p>
 </div>
 ) : (
 <div className="space-y-8">
 {/* Published */}
 {published.length > 0 && (
 <section>
 <div className="flex items-center gap-2 mb-4">
 <BookOpen className="w-4 h-4 text-emerald-500" />
 <h2 className="text-sm font-semibold text-slate-700 dark:text-muted-foreground uppercase tracking-wide">
 Đã xuất bản
 </h2>
 <span className="text-xs text-muted-foreground">({published.length})</span>
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
 <h2 className="text-sm font-semibold text-slate-700 dark:text-muted-foreground uppercase tracking-wide">
 Bản nháp
 </h2>
 <span className="text-xs text-muted-foreground">({drafts.length})</span>
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
 <ExamDetailModal 
 exam={selected} 
 onClose={() => setSelected(null)} 
 onExamDeleted={() => {
 setSelected(null)
 fetchExams()
 }}
 onExamUpdated={(updatedExam) => {
 setSelected(updatedExam)
 fetchExams()
 }}
 />
 )}
 </div>
 )
}
