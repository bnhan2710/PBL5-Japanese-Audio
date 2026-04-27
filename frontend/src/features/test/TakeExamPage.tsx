import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
 ArrowLeft,
 CheckCircle2,
 ChevronLeft,
 ChevronRight,
 Clock3,
 Flag,
 Loader2,
 PlayCircle,
 Send,
 Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { toast } from '@/hooks/use-toast'
import { TestAudioPlayer } from './components/TestAudioPlayer'
import { testClient } from './api/testClient'
import { TestExamDetail, TestQuestion, TestSubmitResult } from './types'
import { CompetencyAnalysisModal } from './components/CompetencyAnalysisModal'

type AnswerMap = Record<string, string>
type ReviewMap = Record<string, boolean>

function formatCountdown(totalSeconds: number) {
 const safeValue = Math.max(0, totalSeconds)
 const hours = Math.floor(safeValue / 3600)
 const minutes = Math.floor((safeValue % 3600) / 60)
 const seconds = safeValue % 60
 return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':')
}

function getOptionLabel(index: number) {
	return String.fromCharCode(65 + index)
}

function getQuestionStatus(question: TestQuestion, answers: AnswerMap, reviews: ReviewMap) {
 if (reviews[question.question_id]) return 'review'
 if (answers[question.question_id]) return 'answered'
 return 'idle'
}

function isScoredQuestion(question: TestQuestion) {
 return (question.question_number ?? 0) > 0
}

function getGlobalAudioUrl(exam: TestExamDetail | null): string | undefined {
 if (!exam) return undefined
 if (exam.audio_url) return exam.audio_url

 // Fallback: If global audio is missing but we have clipped question audio (from AI generation),
 // we can reconstruct the full audio URL by removing the Cloudinary trim variables!
 const firstClip = exam.questions.find(q => q.audio_clip_url)?.audio_clip_url
 if (firstClip) {
 // Match segment like /so_10.../ or /eo_20.../ and replace with /
 return firstClip.replace(/\/?(?:so_[\d.]+|eo_[\d.]+)(?:,(?:so_[\d.]+|eo_[\d.]+))?\//, '/')
 }
 return undefined
}

interface TakeExamContentProps {
 examId: string
 initialAudioMode?: 'practice' | 'simulation'
 initialExam?: TestExamDetail
 submitExam?: (payload: {
 answers: { question_id: string; answer_id: string | null }[]
 elapsed_seconds: number
 }) => Promise<TestSubmitResult>
 onClose?: () => void
 standalone?: boolean
 variant?: 'default' | 'arena'
 returnPath?: string
}

export function TakeExamContent({
 examId,
 initialAudioMode,
 initialExam,
 submitExam,
 onClose,
 standalone = false,
 variant = 'default',
 returnPath,
}: TakeExamContentProps) {
 const navigate = useNavigate()
 const [exam, setExam] = useState<TestExamDetail | null>(null)
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState('')
 const [activeQuestionId, setActiveQuestionId] = useState<string>('')
 const [answers, setAnswers] = useState<AnswerMap>({})
 const [reviews, setReviews] = useState<ReviewMap>({})
 const [remainingSeconds, setRemainingSeconds] = useState(0)
 const [submitting, setSubmitting] = useState(false)
 const [result, setResult] = useState<TestSubmitResult | null>(null)
 const [showAnalysis, setShowAnalysis] = useState(false)
 const [autoSubmitted, setAutoSubmitted] = useState(false)
 const [startPhase, setStartPhase] = useState<'ready' | 'countdown' | 'active'>('ready')
 const [countdownSeconds, setCountdownSeconds] = useState(3)
 const [audioAutoPlaySignal, setAudioAutoPlaySignal] = useState(0)
 const [simulationAudioBlocked, setSimulationAudioBlocked] = useState(false)
 const simulationAudioRef = useRef<HTMLAudioElement>(null)
 const countdownIntervalRef = useRef<number | null>(null)
 const startTimeoutRef = useRef<number | null>(null)
 const selectedAudioMode = initialAudioMode || exam?.audio_mode || 'practice'
 const simulationAudioSrc = useMemo(() => getGlobalAudioUrl(exam), [exam])

 useEffect(() => {
 if (startPhase !== 'active' || selectedAudioMode !== 'simulation') return
 const audio = simulationAudioRef.current
 if (!audio) return

 const tryPlay = async () => {
 try {
 await audio.play()
 setSimulationAudioBlocked(false)
 } catch (err) {
 console.warn('Autoplay failed:', err)
 setSimulationAudioBlocked(true)
 toast({
 title: 'Chưa thể tự phát audio',
 description: 'Vui lòng nhấp vào nút "Tiếp tục phát audio" để nghe.',
 variant: 'destructive',
 })
 }
 }

 void tryPlay()
 }, [simulationAudioSrc, startPhase, selectedAudioMode])

 const headerAccentClass =
 variant === 'arena'
 ? 'text-orange-950'
 : 'text-teal-950'
 const timerToneClass =
 variant === 'arena'
 ? 'rounded-full bg-orange-100 px-5 py-3 text-orange-800'
 : ''

 const handleResumeSimulationAudio = async () => {
 const audio = simulationAudioRef.current
 if (!audio) return
 try {
 await audio.play()
 setSimulationAudioBlocked(false)
 } catch (err: any) {
 toast({
 title: 'Không thể phát audio',
 description: err?.message || 'Vui lòng thử lại.',
 variant: 'destructive',
 })
 }
 }

 useEffect(() => {
 if (!examId) {
 setError('Thiếu mã đề thi')
 setLoading(false)
 return
 }

 setLoading(true)
 const loadExam = initialExam ? Promise.resolve(initialExam) : testClient.getExamDetail(examId)
 loadExam
 .then((data) => {
 setExam(data)
 setActiveQuestionId(data.questions[0]?.question_id || '')
 setRemainingSeconds((data.time_limit || 45) * 60)
 setAutoSubmitted(false)
 setStartPhase('ready')
 setCountdownSeconds(3)
 setAudioAutoPlaySignal(0)
 setSimulationAudioBlocked(false)
 })
 .catch((err: Error) => setError(err.message || 'Không tải được bài thi'))
 .finally(() => setLoading(false))
 }, [examId, initialExam])

 useEffect(() => {
 if (!exam || result || submitting || autoSubmitted || startPhase !== 'active') return
 if (remainingSeconds <= 0) {
 setAutoSubmitted(true)
 void handleSubmit(true)
 return
 }

 const timer = window.setInterval(() => {
 setRemainingSeconds((current) => Math.max(0, current - 1))
 }, 1000)

 return () => window.clearInterval(timer)
 }, [autoSubmitted, exam, remainingSeconds, result, startPhase, submitting])

 const groupedQuestions = useMemo(() => {
 if (!exam) return []

 const groups = new Map<string, TestQuestion[]>()
 exam.questions.forEach((question) => {
 const key = question.mondai_group || 'Khác'
 const bucket = groups.get(key) || []
 bucket.push(question)
 groups.set(key, bucket)
 })

 return Array.from(groups.entries()).map(([label, questions]) => ({ label, questions }))
 }, [exam])

 const activeQuestion = exam?.questions.find((question) => question.question_id === activeQuestionId) || null
 const activeIndex = exam?.questions.findIndex((question) => question.question_id === activeQuestionId) ?? -1

 const answeredCount =
 exam?.questions.filter((question) => isScoredQuestion(question) && answers[question.question_id]).length || 0
 const activeGroup = activeQuestion?.mondai_group || 'Mondai'
 const activeGroupQuestions = groupedQuestions.find((group) => group.label === activeGroup)?.questions || []
 const activeGroupStart = activeGroupQuestions[0]?.question_number ?? 1
 const activeGroupEnd =
 activeGroupQuestions[activeGroupQuestions.length - 1]?.question_number ?? activeGroupQuestions.length ?? 1

 useEffect(() => {
 return () => {
 if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current)
 if (startTimeoutRef.current) window.clearTimeout(startTimeoutRef.current)
 simulationAudioRef.current?.pause()
 }
 }, [])

 const moveQuestion = (step: number) => {
 if (!exam || activeIndex < 0) return
 const nextQuestion = exam.questions[activeIndex + step]
 if (nextQuestion) setActiveQuestionId(nextQuestion.question_id)
 }

 const chooseAnswer = (questionId: string, answerId: string) => {
 setAnswers((current) => ({ ...current, [questionId]: answerId }))
 }

 const toggleReview = (questionId: string) => {
 setReviews((current) => ({ ...current, [questionId]: !current[questionId] }))
 }

 const beginExam = () => {
 if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current)
 if (startTimeoutRef.current) window.clearTimeout(startTimeoutRef.current)

 // Prime simulation audio in a direct user gesture to avoid autoplay block after countdown.
 if (selectedAudioMode === 'simulation' && simulationAudioRef.current) {
 const audio = simulationAudioRef.current
 audio.muted = true
 void audio.play()
 .then(() => {
 audio.pause()
 audio.currentTime = 0
 audio.muted = false
 setSimulationAudioBlocked(false)
 })
 .catch(() => {
 audio.muted = false
 })
 }

 setCountdownSeconds(3)
 setStartPhase('countdown')

 countdownIntervalRef.current = window.setInterval(() => {
 setCountdownSeconds((current) => {
 if (current <= 1) {
 if (countdownIntervalRef.current) {
 window.clearInterval(countdownIntervalRef.current)
 countdownIntervalRef.current = null
 }
 return 1
 }
 return current - 1
 })
 }, 1000)

 startTimeoutRef.current = window.setTimeout(() => {
 setStartPhase('active')
 setCountdownSeconds(3)

 if (selectedAudioMode !== 'simulation') {
 setAudioAutoPlaySignal((current) => current + 1)
 }
 }, 3000)
 }

 const handleSubmit = async (autoSubmit = false) => {
 if (!exam || submitting || result) return

 // Stop all playing audio when submitting
 document.querySelectorAll('audio').forEach((el) => {
   el.pause()
 })

 if (!autoSubmit) {
 const confirmed = window.confirm('Bạn có chắc muốn nộp bài thi ngay bây giờ?')
 if (!confirmed) return
 }

 setSubmitting(true)
 try {
 const payload = {
 answers: exam.questions.map((question) => ({
 question_id: question.question_id,
 answer_id: answers[question.question_id] || null,
 })),
 elapsed_seconds: (exam.time_limit || 45) * 60 - remainingSeconds,
 }
 const submitResult = submitExam
 ? await submitExam(payload)
 : await testClient.submitExam(exam.exam_id, payload)
 setResult(submitResult)
 toast({
 title: autoSubmit ? 'Hết giờ, bài thi đã được nộp' : 'Nộp bài thành công',
 description: `Điểm IRT: ${submitResult.score}/60. Bạn đúng ${submitResult.correct_answers}/${submitResult.total_questions} câu.`,
 })
 } catch (submitError: any) {
 toast({
 title: 'Không thể nộp bài',
 description: submitError.message || 'Vui lòng thử lại sau.',
 variant: 'destructive',
 })
 } finally {
 setSubmitting(false)
 }
 }

 if (loading) {
 return (
 <div className="flex min-h-[60vh] items-center justify-center">
 <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
 </div>
 )
 }

 if (error || !exam || !activeQuestion) {
 return (
 <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-red-50 px-8 py-10 text-center">
 <p className="text-lg font-semibold text-red-700">{error || 'Không thể hiển thị bài thi'}</p>
 <Button className="mt-5" variant="outline" onClick={() => (onClose ? onClose() : navigate('/exam'))}>
 {onClose ? 'Đóng' : 'Quay lại'}
 </Button>
 </div>
 )
 }

 return (
 <div className={standalone ? 'mx-auto max-w-[1650px]' : 'mx-auto max-w-[1500px]'}>
 <section className="overflow-hidden rounded-[36px] border border-border bg-card shadow-xl shadow-slate-200/50">
 <div className="border-b border-border bg-card px-6 py-6 sm:px-8">
 <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
 <div className="flex min-w-0 items-center gap-4">
 {onClose ? (
 <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
 <ArrowLeft className="h-5 w-5" />
 </Button>
 ) : (
 <Button asChild variant="ghost" size="icon" className="rounded-full">
 <Link to={`/test/exams/${exam.exam_id}`}>
 <ArrowLeft className="h-5 w-5" />
 </Link>
 </Button>
 )}
 <div className="min-w-0">
 <p className={`truncate text-base font-black tracking-tight ${headerAccentClass}`}>{exam.title}</p>
 <p className="mt-1 text-[11px] text-muted-foreground">
 {exam.mondai_groups.length} mondai · {exam.total_questions} câu hỏi
 </p>
 </div>
 </div>

 <div className="justify-self-start lg:justify-self-center">
 <div className={`flex items-center gap-3 text-slate-700 ${timerToneClass}`}>
 <span className="text-xl font-black tracking-[0.08em] sm:text-[28px]">
 {formatCountdown(remainingSeconds)}
 </span>
 <Clock3 className="h-5 w-5 text-muted-foreground" />
 </div>
 </div>

 <div className="justify-self-start lg:justify-self-end">
 <Button
 size="lg"
 onClick={() => void handleSubmit(false)}
 disabled={submitting || !!result}
 className="rounded-full bg-emerald-500 px-6 py-4 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
 >
 {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
 Nộp bài
 </Button>
 </div>
 </div>
 </div>

 <div className="bg-[#f6f7ff] px-6 py-8 sm:px-8 sm:py-10">
 <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[245px_minmax(0,1fr)]">
 <aside className="space-y-6">
 <div className="inline-flex items-center gap-1 rounded-2xl bg-emerald-100 px-4 py-2 text-[11px] font-bold text-emerald-900 sm:text-xs">
 Đã làm <span className="text-emerald-500">{answeredCount}</span>/{exam.total_questions} câu
 </div>

 <div className="space-y-7">
 {groupedQuestions.map((group, groupIndex) => (
 <section key={group.label}>
 <div className="mb-4 flex items-center gap-3">
 <span
 className={[
 'block h-9 w-1 rounded-full',
 groupIndex === 0 ? 'bg-orange-400' : 'bg-slate-400',
 ].join(' ')}
 />
 <div className="text-sm font-black text-foreground">
 {group.label}
 </div>
 </div>

 <div className="grid grid-cols-4 gap-y-2.5 gap-x-1.5">
 {group.questions.map((question) => {
 const status = getQuestionStatus(question, answers, reviews)
 const isActive = question.question_id === activeQuestionId

 const toneClass =
 isActive
 ? 'border-2 border-blue-400 bg-card text-blue-700 shadow-lg shadow-blue-100'
 : status === 'answered'
 ? 'bg-emerald-100 text-emerald-900'
 : status === 'review'
 ? 'bg-amber-100 text-amber-900'
 : 'bg-card text-slate-700'

 return (
 <button
 key={question.question_id}
 type="button"
 onClick={() => setActiveQuestionId(question.question_id)}
 className={[
 'relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black transition-all',
 toneClass,
 ].join(' ')}
 >
 {question.question_number ?? '?'}
 {status === 'review' && (
 <Flag className="absolute -right-1 -top-1 h-4 w-4 text-amber-500" />
 )}
 </button>
 )
 })}
 </div>
 </section>
 ))}
 </div>
 </aside>

 <main className="min-w-0">
 <div className="space-y-6">
 <div className="rounded-[28px] border border-border bg-card px-6 py-6 shadow-sm">
 <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center gap-4">
 <span className="rounded-xl bg-blue-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-blue-700 sm:text-xs">
 {activeGroup}
 </span>
 <span className="text-lg font-black text-foreground sm:text-xl">
 Câu {activeQuestion.question_number ?? '?'}
 </span>
 </div>

 <button
 type="button"
 onClick={() => toggleReview(activeQuestion.question_id)}
 className={[
 'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold transition-colors sm:text-xs',
 reviews[activeQuestion.question_id]
 ? 'border-amber-300 bg-amber-50 text-amber-700'
 : 'border-border bg-card text-muted-foreground hover:border-amber-300 hover:text-amber-700',
 ].join(' ')}
 >
 <Flag className="h-4 w-4" />
 Đánh dấu xem lại
 </button>
 </div>

 {selectedAudioMode !== 'simulation' && (activeQuestion.audio_clip_url || exam.audio_url) && (
 <div className="mb-6">
 <TestAudioPlayer
 compact
 title="Nghe câu hỏi"
 url={activeQuestion.audio_clip_url || exam.audio_url}
 mode={selectedAudioMode}
 autoPlaySignal={audioAutoPlaySignal}
 />
 </div>
 )}

 {!activeQuestion.hide_question_text && (
 <div className="rounded-[24px] border border-border bg-card px-6 py-6 shadow-sm">
 <p className="text-base leading-[1.7] text-foreground sm:text-lg">
 {activeQuestion.question_text || 'Câu hỏi chưa có nội dung'}
 </p>
 </div>
 )}

 {activeQuestion.image_url && (
 <div className="mt-6 overflow-hidden rounded-[24px] border border-border bg-card">
 <img
 src={activeQuestion.image_url}
 alt={`Question ${activeQuestion.question_number}`}
 className="h-auto max-h-[420px] w-full object-cover"
 />
 </div>
 )}
 </div>

 <div className="space-y-4">
 {activeQuestion.answers.map((answer, index) => {
 const selected = answers[activeQuestion.question_id] === answer.answer_id
 const compactAnswerMode = !!activeQuestion.hide_question_text
 return (
 <button
 key={answer.answer_id}
 type="button"
 onClick={() => chooseAnswer(activeQuestion.question_id, answer.answer_id)}
 className={[
 compactAnswerMode
 ? 'flex w-full items-center gap-4 rounded-[22px] border bg-card px-4 py-4 text-left transition-all'
 : 'flex w-full items-center gap-5 rounded-[28px] border bg-card px-6 py-5 text-left transition-all',
 selected
 ? 'border-emerald-400 shadow-lg shadow-emerald-100'
 : 'border-border hover:border-emerald-300 hover:shadow-sm',
 ].join(' ')}
 >
 <span
 className={[
 compactAnswerMode
 ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black'
 : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 text-xs font-black',
 selected
 ? 'border-emerald-400 bg-emerald-400 text-white'
 : 'border-border text-muted-foreground',
 ].join(' ')}
 >
 {getOptionLabel(index)}
 </span>
 {!compactAnswerMode && (
 <div className="flex-1">
 <p className="text-sm leading-[1.6] text-foreground sm:text-base">
 {answer.content || 'Đáp án dạng hình ảnh'}
 </p>
 {answer.image_url && (
 <img
 src={answer.image_url}
 alt={`Answer ${index + 1}`}
 className="mt-4 max-h-40 rounded-2xl border border-border object-cover"
 />
 )}
 </div>
 )}
 </button>
 )
 })}
 </div>
 </div>
 </main>
 </div>
 </div>

 <div className="border-t border-border bg-card px-6 py-5 sm:px-8">
 <div className="grid items-center gap-4 lg:grid-cols-[160px_minmax(0,1fr)_160px]">
 <div className="justify-self-start">
 <button
 type="button"
 onClick={() => moveQuestion(-1)}
 disabled={activeIndex <= 0}
 className="inline-flex h-12 w-24 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground transition-colors hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
 >
 <ChevronLeft className="h-6 w-6" />
 </button>
 </div>

 <div className="text-center text-sm font-black text-muted-foreground sm:text-base">
 {activeGroup}: {activeGroupStart} -&gt; {activeGroupEnd}
 </div>

 <div className="justify-self-end">
 <button
 type="button"
 onClick={() => moveQuestion(1)}
 disabled={activeIndex >= exam.questions.length - 1}
 className="inline-flex h-12 w-24 items-center justify-center rounded-full border-2 border-emerald-400 bg-card text-emerald-500 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
 >
 <ChevronRight className="h-6 w-6" />
 </button>
 </div>
 </div>
 </div>
 </section>

 {selectedAudioMode === 'simulation' && simulationAudioSrc && (
 <audio ref={simulationAudioRef} src={simulationAudioSrc} preload="auto" className="hidden" />
 )}

 {selectedAudioMode === 'simulation' && startPhase === 'active' && simulationAudioBlocked && (
 <div className="fixed bottom-6 right-6 z-40">
 <Button
 className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
 onClick={() => void handleResumeSimulationAudio()}
 >
 <PlayCircle className="mr-2 h-4 w-4" />
 Tiếp tục phát audio
 </Button>
 </div>
 )}

 {result && (
 <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
 <div className="w-full max-w-xl rounded-[32px] border border-border bg-card p-8 shadow-2xl">
 <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
 <CheckCircle2 className="h-7 w-7" />
 </div>
 <h2 className="text-3xl font-black tracking-tight text-foreground">Bài thi đã được nộp</h2>
 <p className="mt-3 text-base leading-7 text-muted-foreground">
 Kết quả đã được lưu vào hệ thống. Bạn có thể quay lại danh sách đề thi hoặc xem lại điểm số tổng hợp bên dưới.
 </p>

 <div className="mt-6 grid gap-3 sm:grid-cols-3">
 <div className={`rounded-2xl border px-4 py-4 ${
 result.score <= 19 ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
 }`}>
 <p className="text-sm opacity-80 font-medium">Điểm (IRT)</p>
 <div className="flex items-baseline gap-2 mt-1">
 <p className="text-3xl font-black">{result.score.toFixed(2)}</p>
 <p className="text-sm font-bold opacity-75">/ 60</p>
 </div>
 <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
 result.score <= 19 ? 'bg-rose-200/50 text-rose-700' : 'bg-emerald-200/50 text-emerald-700'
 }`}>
 {result.score <= 19 ? 'Rớt' : 'Đậu'}
 </span>
 </div>
 <div className="rounded-2xl border border-border bg-slate-50 px-4 py-4 text-foreground">
 <p className="text-sm text-muted-foreground font-medium">Đúng</p>
 <div className="flex items-baseline gap-2 mt-1">
 <p className="text-3xl font-black">
 {result.correct_answers}
 </p>
 <p className="text-sm font-bold text-muted-foreground">/ {result.total_questions}</p>
 </div>
 </div>
 <div className="rounded-2xl border border-border bg-slate-50 px-4 py-4 text-foreground">
 <p className="text-sm text-muted-foreground font-medium">Đã trả lời</p>
 <p className="mt-1 text-3xl font-black">{result.answered_questions}</p>
 </div>
 </div>

 <div className="mt-7 flex flex-wrap justify-end gap-3">
 <Button variant="outline" className="rounded-2xl px-5" onClick={() => setResult(null)}>
 {onClose ? 'Tiếp tục xem' : 'Ở lại trang này'}
 </Button>
 <Button
 className="rounded-2xl bg-indigo-600 px-5 font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"
 onClick={() => setShowAnalysis(true)}
 >
 <Sparkles className="mr-2 h-4 w-4" />
 Xem đánh giá năng lực (AI)
 </Button>
 <Button
 className="rounded-2xl bg-blue-600 px-5 hover:bg-blue-700"
 onClick={() => (onClose ? onClose() : navigate(returnPath || '/exam'))}
 >
 {onClose ? 'Đóng cửa sổ' : variant === 'arena' ? 'Về cuộc thi' : 'Về danh sách đề'}
 </Button>
 </div>
 </div>
 </div>
 )}

 {showAnalysis && result && (
 <CompetencyAnalysisModal
 resultId={result.result_id}
 onClose={() => setShowAnalysis(false)}
 />
 )}

 {startPhase !== 'active' && !result && (
 <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
 <div className="w-full max-w-md rounded-[32px] border border-border bg-card p-8 text-center shadow-2xl">
 {startPhase === 'ready' ? (
 <>
 <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
 <PlayCircle className="h-8 w-8" />
 </div>
 <h2 className="text-3xl font-black tracking-tight text-foreground">Bắt đầu bài thi</h2>
 <p className="mt-3 text-base leading-7 text-muted-foreground">
 Khi bắt đầu, hệ thống sẽ đếm ngược 3 giây rồi phát audio.
 </p>
 <Button
 size="lg"
 className="mt-6 rounded-2xl bg-blue-600 px-8 text-base font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700"
 onClick={beginExam}
 >
 Bắt đầu bài thi
 </Button>
 </>
 ) : (
 <>
 <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Sẵn sàng</p>
 <div className="mt-4 text-7xl font-black leading-none text-blue-600">{countdownSeconds}</div>
 <p className="mt-4 text-base text-muted-foreground">Audio sẽ bắt đầu ngay sau khi đếm ngược kết thúc.</p>
 </>
 )}
 </div>
 </div>
 )}
 </div>
 )
}

export default function TakeExamPage() {
 const { examId } = useParams()
 const location = useLocation()
 const [searchParams] = useSearchParams()

 if (!examId) {
 return (
 <div className="flex min-h-[60vh] items-center justify-center">
 <p className="text-sm text-red-600">Thiếu mã đề thi</p>
 </div>
 )
 }

 const initialAudioMode =
 (searchParams.get('audioMode') as 'practice' | 'simulation' | null)
 || (location.state as { audioMode?: 'practice' | 'simulation' } | null)?.audioMode
 || undefined

 return <TakeExamContent examId={examId} initialAudioMode={initialAudioMode} standalone />
}
