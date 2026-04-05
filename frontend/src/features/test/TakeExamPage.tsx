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
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { toast } from '@/hooks/use-toast'
import { TestAudioPlayer } from './components/TestAudioPlayer'
import { testClient } from './api/testClient'
import { TestExamDetail, TestQuestion, TestSubmitResult } from './types'

type AnswerMap = Record<string, string>
type ReviewMap = Record<string, boolean>

function formatCountdown(totalSeconds: number) {
  const safeValue = Math.max(0, totalSeconds)
  const hours = Math.floor(safeValue / 3600)
  const minutes = Math.floor((safeValue % 3600) / 60)
  const seconds = safeValue % 60
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':')
}

function getQuestionStatus(question: TestQuestion, answers: AnswerMap, reviews: ReviewMap) {
  if (reviews[question.question_id]) return 'review'
  if (answers[question.question_id]) return 'answered'
  return 'idle'
}

interface TakeExamContentProps {
  examId: string
  initialAudioMode?: 'practice' | 'simulation'
  onClose?: () => void
  standalone?: boolean
}

export function TakeExamContent({
  examId,
  initialAudioMode = 'practice',
  onClose,
  standalone = false,
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
  const [autoSubmitted, setAutoSubmitted] = useState(false)
  const [startPhase, setStartPhase] = useState<'ready' | 'countdown' | 'active'>('ready')
  const [countdownSeconds, setCountdownSeconds] = useState(3)
  const [audioAutoPlaySignal, setAudioAutoPlaySignal] = useState(0)
  const simulationAudioRef = useRef<HTMLAudioElement>(null)
  const countdownIntervalRef = useRef<number | null>(null)
  const startTimeoutRef = useRef<number | null>(null)
  const selectedAudioMode = initialAudioMode || exam?.audio_mode || 'practice'

  useEffect(() => {
    if (!examId) {
      setError('Thiếu mã đề thi')
      setLoading(false)
      return
    }

    setLoading(true)
    testClient
      .getExamDetail(examId)
      .then((data) => {
        setExam(data)
        setActiveQuestionId(data.questions[0]?.question_id || '')
        setRemainingSeconds((data.time_limit || 45) * 60)
        setAutoSubmitted(false)
        setStartPhase('ready')
        setCountdownSeconds(3)
        setAudioAutoPlaySignal(0)
      })
      .catch((err: Error) => setError(err.message || 'Không tải được bài thi'))
      .finally(() => setLoading(false))
  }, [examId])

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

  const answeredCount = exam?.questions.filter((question) => answers[question.question_id]).length || 0
  const activeGroup = activeQuestion?.mondai_group || 'Mondai'
  const activeGroupQuestions = groupedQuestions.find((group) => group.label === activeGroup)?.questions || []
  const activeGroupStart = activeGroupQuestions[0]?.question_number || 1
  const activeGroupEnd =
    activeGroupQuestions[activeGroupQuestions.length - 1]?.question_number || activeGroupQuestions.length || 1

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

    startTimeoutRef.current = window.setTimeout(async () => {
      setStartPhase('active')
      setCountdownSeconds(3)

      if (selectedAudioMode === 'simulation') {
        const audio = simulationAudioRef.current
        if (audio) {
          audio.currentTime = 0
          audio.load()
          try {
            await audio.play()
          } catch {
            toast({
              title: 'Không thể tự phát audio',
              description: 'Trình duyệt đang chặn autoplay. Hãy nhấp một lần trong tab này rồi thử lại.',
              variant: 'destructive',
            })
          }
        }
      } else {
        setAudioAutoPlaySignal((current) => current + 1)
      }
    }, 3000)
  }

  const handleSubmit = async (autoSubmit = false) => {
    if (!exam || submitting || result) return

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
      const submitResult = await testClient.submitExam(exam.exam_id, payload)
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
          {onClose ? 'Đóng' : 'Quay lại danh sách đề'}
        </Button>
      </div>
    )
  }

  return (
    <div className={standalone ? 'mx-auto max-w-[1650px]' : 'mx-auto max-w-[1500px]'}>
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
        <div className="border-b border-slate-200 bg-white px-6 py-6 sm:px-8">
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
                <p className="truncate text-base font-black tracking-tight text-teal-950">{exam.title}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {exam.mondai_groups.length} mondai · {exam.total_questions} câu hỏi
                </p>
              </div>
            </div>

            <div className="justify-self-start lg:justify-self-center">
              <div className="flex items-center gap-3 text-slate-700">
                <span className="text-xl font-black tracking-[0.08em] sm:text-[28px]">
                  {formatCountdown(remainingSeconds)}
                </span>
                <Clock3 className="h-5 w-5 text-slate-400" />
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
                      <div className="text-sm font-black text-slate-900">
                        {group.label}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-y-2.5 gap-x-1.5">
                      {group.questions.map((question) => {
                        const status = getQuestionStatus(question, answers, reviews)
                        const isActive = question.question_id === activeQuestionId

                        const toneClass =
                          isActive
                            ? 'border-2 border-blue-400 bg-white text-blue-700 shadow-lg shadow-blue-100'
                            : status === 'answered'
                              ? 'bg-emerald-100 text-emerald-900'
                              : status === 'review'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-white text-slate-700'

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
                            {question.question_number || '?'}
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
                <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <span className="rounded-xl bg-blue-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-blue-700 sm:text-xs">
                        {activeGroup}
                      </span>
                      <span className="text-lg font-black text-slate-900 sm:text-xl">
                        Câu {activeQuestion.question_number || '?'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleReview(activeQuestion.question_id)}
                      className={[
                        'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold transition-colors sm:text-xs',
                        reviews[activeQuestion.question_id]
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700',
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

                  <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
                    <p className="text-base leading-[1.7] text-slate-900 sm:text-lg">
                      {activeQuestion.question_text || 'Câu hỏi chưa có nội dung'}
                    </p>
                  </div>

                  {activeQuestion.image_url && (
                    <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
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
                    return (
                      <button
                        key={answer.answer_id}
                        type="button"
                        onClick={() => chooseAnswer(activeQuestion.question_id, answer.answer_id)}
                        className={[
                          'flex w-full items-center gap-5 rounded-[28px] border bg-white px-6 py-5 text-left transition-all',
                          selected
                            ? 'border-emerald-400 shadow-lg shadow-emerald-100'
                            : 'border-slate-200 hover:border-emerald-300 hover:shadow-sm',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 text-xs font-black',
                            selected
                              ? 'border-emerald-400 bg-emerald-400 text-white'
                              : 'border-slate-200 text-slate-500',
                          ].join(' ')}
                        >
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm leading-[1.6] text-slate-900 sm:text-base">
                            {answer.content || 'Đáp án dạng hình ảnh'}
                          </p>
                          {answer.image_url && (
                            <img
                              src={answer.image_url}
                              alt={`Answer ${index + 1}`}
                              className="mt-4 max-h-40 rounded-2xl border border-slate-200 object-cover"
                            />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </main>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-6 py-5 sm:px-8">
          <div className="grid items-center gap-4 lg:grid-cols-[160px_minmax(0,1fr)_160px]">
            <div className="justify-self-start">
              <button
                type="button"
                onClick={() => moveQuestion(-1)}
                disabled={activeIndex <= 0}
                className="inline-flex h-12 w-24 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-400 transition-colors hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            </div>

            <div className="text-center text-sm font-black text-slate-600 sm:text-base">
              {activeGroup}: {activeGroupStart} -&gt; {activeGroupEnd}
            </div>

            <div className="justify-self-end">
              <button
                type="button"
                onClick={() => moveQuestion(1)}
                disabled={activeIndex >= exam.total_questions - 1}
                className="inline-flex h-12 w-24 items-center justify-center rounded-full border-2 border-emerald-400 bg-white text-emerald-500 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {selectedAudioMode === 'simulation' && exam.audio_url && (
        <audio ref={simulationAudioRef} src={exam.audio_url} preload="auto" className="hidden" />
      )}

      {result && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-2xl">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Bài thi đã được nộp</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
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
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-900">
                <p className="text-sm text-slate-500 font-medium">Đúng</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-3xl font-black">
                    {result.correct_answers}
                  </p>
                  <p className="text-sm font-bold text-slate-400">/ {result.total_questions}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-900">
                <p className="text-sm text-slate-500 font-medium">Đã trả lời</p>
                <p className="mt-1 text-3xl font-black">{result.answered_questions}</p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <Button variant="outline" className="rounded-2xl px-5" onClick={() => setResult(null)}>
                {onClose ? 'Tiếp tục xem' : 'Ở lại trang này'}
              </Button>
              <Button
                className="rounded-2xl bg-blue-600 px-5 hover:bg-blue-700"
                onClick={() => (onClose ? onClose() : navigate('/exam'))}
              >
                {onClose ? 'Đóng cửa sổ' : 'Về danh sách đề'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {startPhase !== 'active' && !result && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-2xl">
            {startPhase === 'ready' ? (
              <>
                <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                  <PlayCircle className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900">Bắt đầu bài thi</h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
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
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Sẵn sàng</p>
                <div className="mt-4 text-7xl font-black leading-none text-blue-600">{countdownSeconds}</div>
                <p className="mt-4 text-base text-slate-600">Audio sẽ bắt đầu ngay sau khi đếm ngược kết thúc.</p>
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
    || 'practice'

  return <TakeExamContent examId={examId} initialAudioMode={initialAudioMode} standalone />
}
