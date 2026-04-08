import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
 ArrowLeft,
 BookOpen,
 Clock3,
 Layers3,
 Loader2,
 PlayCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { testClient } from './api/testClient'
import { TestExamDetail } from './types'

function formatDuration(minutes?: number | null) {
 if (!minutes) return 'Không giới hạn'
 if (minutes < 60) return `${minutes} phút`
 const hours = Math.floor(minutes / 60)
 const remain = minutes % 60
 return remain > 0 ? `${hours}h ${remain}m` : `${hours} giờ`
}

export default function TestExamDetailPage() {
 const { examId } = useParams()
 const navigate = useNavigate()
 const [exam, setExam] = useState<TestExamDetail | null>(null)
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState('')
 const [audioMode, setAudioMode] = useState<'practice' | 'simulation'>('practice')

 useEffect(() => {
 if (!examId) {
 setError('Thiếu mã đề thi')
 setLoading(false)
 return
 }

 setLoading(true)
 testClient
 .getExamDetail(examId)
 .then((data) => setExam(data))
 .catch((err: Error) => setError(err.message || 'Không tải được chi tiết đề thi'))
 .finally(() => setLoading(false))
 }, [examId])

 if (loading) {
 return (
 <div className="flex min-h-[60vh] items-center justify-center">
 <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
 </div>
 )
 }

 if (error || !exam) {
 return (
 <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-red-50 px-8 py-10 text-center">
 <p className="text-lg font-semibold text-red-700">{error || 'Không tìm thấy đề thi'}</p>
 <Button className="mt-5" variant="outline" onClick={() => navigate('/exam')}>
 Quay lại danh sách đề
 </Button>
 </div>
 )
 }

 return (
 <div className="mx-auto flex max-w-6xl flex-col gap-6">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <Button asChild variant="ghost" className="px-0 text-muted-foreground hover:bg-transparent">
 <Link to="/exam">
 <ArrowLeft className="h-4 w-4" />
 Quay lại danh sách đề
 </Link>
 </Button>
 </div>

 <section className="rounded-[32px] border border-blue-100 bg-gradient-to-br from-white via-sky-50 to-blue-50 p-8 shadow-sm">
 <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
 <div className="max-w-3xl">
 <div className="mb-4 flex flex-wrap items-center gap-3">
 <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
 JLPT Listening Test
 </span>
 <span
 className={[
 'rounded-full px-3 py-1 text-sm font-semibold',
 exam.is_published
 ? 'bg-emerald-100 text-emerald-700'
 : 'bg-amber-100 text-amber-700',
 ].join(' ')}
 >
 {exam.is_published ? 'Đề đã xuất bản' : 'Bản nháp đang preview'}
 </span>
 </div>
 <h1 className="text-3xl font-black tracking-tight text-foreground">{exam.title}</h1>
 <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
 {exam.description || 'Đề thi nghe gồm nhiều mondai, được trình bày theo cấu trúc JLPT để người dùng luyện tập trực tiếp trên giao diện web.'}
 </p>
 <div className="mt-6 max-w-2xl">
 <p className="mb-3 text-sm font-semibold text-slate-700">Chế độ nghe</p>
 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <button
 type="button"
 onClick={() => setAudioMode('simulation')}
 className={[
 'rounded-2xl border px-4 py-3 text-left transition-colors',
 audioMode === 'simulation'
 ? 'border-blue-500 bg-blue-50 text-blue-700'
 : 'border-border bg-card text-muted-foreground hover:border-border',
 ].join(' ')}
 >
 <p className="text-sm font-bold">Nghe mô phỏng thi</p>
 <p className="mt-1 text-xs opacity-80">Không có nút điều khiển âm thanh khi thi.</p>
 </button>
 <button
 type="button"
 onClick={() => setAudioMode('practice')}
 className={[
 'rounded-2xl border px-4 py-3 text-left transition-colors',
 audioMode === 'practice'
 ? 'border-blue-500 bg-blue-50 text-blue-700'
 : 'border-border bg-card text-muted-foreground hover:border-border',
 ].join(' ')}
 >
 <p className="text-sm font-bold">Nghe luyện tập</p>
 <p className="mt-1 text-xs opacity-80">Có thể phát, tua, chỉnh tốc độ và âm lượng.</p>
 </button>
 </div>
 </div>
 <div className="mt-8 flex justify-center lg:justify-start">
 <Button
 size="lg"
 className="rounded-2xl bg-blue-600 px-8 text-base font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700"
 disabled={exam.questions.length === 0}
 onClick={() => {
 const takeUrl = `/test/exams/${exam.exam_id}/take?audioMode=${audioMode}`
 window.open(takeUrl, '_blank', 'noopener,noreferrer')
 }}
 >
 <PlayCircle className="h-5 w-5" />
 Làm bài thi
 </Button>
 </div>
 </div>

 <div className="grid min-w-[300px] gap-3 sm:grid-cols-3 lg:w-[380px] lg:grid-cols-1">
 <div className="rounded-2xl border border-white/70 bg-card/90 px-4 py-4 shadow-sm">
 <div className="mb-1 flex items-center gap-2 text-muted-foreground">
 <Clock3 className="h-4 w-4" />
 <span className="text-xs font-semibold uppercase tracking-[0.18em]">Thời lượng</span>
 </div>
 <p className="text-xl font-bold text-foreground">{formatDuration(exam.time_limit)}</p>
 </div>
 <div className="rounded-2xl border border-white/70 bg-card/90 px-4 py-4 shadow-sm">
 <div className="mb-1 flex items-center gap-2 text-muted-foreground">
 <BookOpen className="h-4 w-4" />
 <span className="text-xs font-semibold uppercase tracking-[0.18em]">Câu hỏi</span>
 </div>
 <p className="text-xl font-bold text-foreground">{exam.total_questions} câu</p>
 </div>
 <div className="rounded-2xl border border-white/70 bg-card/90 px-4 py-4 shadow-sm">
 <div className="mb-1 flex items-center gap-2 text-muted-foreground">
 <Layers3 className="h-4 w-4" />
 <span className="text-xs font-semibold uppercase tracking-[0.18em]">Mondai</span>
 </div>
 <p className="text-xl font-bold text-foreground">{exam.mondai_groups.length} nhóm</p>
 </div>
 </div>
 </div>
 </section>

 </div>
 )
}
