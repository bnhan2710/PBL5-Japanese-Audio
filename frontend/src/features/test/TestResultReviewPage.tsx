import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  XCircle,
  FileText,
  Brain
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { resultClient } from '../exam/api/resultClient'
import { TestResultReviewResponse, TestQuestionReview } from './types'
import { TestAudioPlayer } from './components/TestAudioPlayer'
import { CompetencyAnalysisModal } from './components/CompetencyAnalysisModal'

function getGlobalAudioUrl(exam: any): string | undefined {
  if (!exam) return undefined
  if (exam.audio_url) return exam.audio_url

  const firstClip = exam.questions?.find((q: any) => q.audio_clip_url)?.audio_clip_url
  if (firstClip) {
    return firstClip.replace(/\/?(?:so_[\d.]+|eo_[\d.]+)(?:,(?:so_[\d.]+|eo_[\d.]+))?\//, '/')
  }
  return undefined
}

export default function TestResultReviewPage() {
  const { resultId } = useParams()
  const navigate = useNavigate()
  
  const [data, setData] = useState<TestResultReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeQuestionId, setActiveQuestionId] = useState<string>('')
  const [showAnalysis, setShowAnalysis] = useState(false)

  useEffect(() => {
    if (!resultId) {
      setError('Thiếu mã kết quả')
      setLoading(false)
      return
    }

    setLoading(true)
    resultClient.getResultReview(resultId)
      .then(res => {
        setData(res)
        if (res.exam.questions.length > 0) {
          setActiveQuestionId(res.exam.questions[0].question_id)
        }
      })
      .catch((err: Error) => setError(err.message || 'Không tải được chi tiết kết quả'))
      .finally(() => setLoading(false))
  }, [resultId])

  const groupedQuestions = useMemo(() => {
    if (!data) return []

    const groups = new Map<string, TestQuestionReview[]>()
    data.exam.questions.forEach((question) => {
      const key = question.mondai_group || 'Khác'
      const bucket = groups.get(key) || []
      bucket.push(question)
      groups.set(key, bucket)
    })

    return Array.from(groups.entries()).map(([label, questions]) => ({ label, questions }))
  }, [data])

  const activeQuestion = data?.exam.questions.find((question) => question.question_id === activeQuestionId) || null
  const activeIndex = data?.exam.questions.findIndex((question) => question.question_id === activeQuestionId) ?? -1

  const activeGroup = activeQuestion?.mondai_group || 'Mondai'
  const activeGroupQuestions = groupedQuestions.find((group) => group.label === activeGroup)?.questions || []
  const activeGroupStart = activeGroupQuestions[0]?.question_number || 1
  const activeGroupEnd =
    activeGroupQuestions[activeGroupQuestions.length - 1]?.question_number || activeGroupQuestions.length || 1

  const moveQuestion = (step: number) => {
    if (!data || activeIndex < 0) return
    const nextQuestion = data.exam.questions[activeIndex + step]
    if (nextQuestion) setActiveQuestionId(nextQuestion.question_id)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !data || !activeQuestion) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-red-50 px-8 py-10 text-center">
        <p className="text-lg font-semibold text-red-700">{error || 'Không thể tải lịch sử làm bài'}</p>
        <Button className="mt-5" variant="outline" onClick={() => navigate('/history')}>
          Quay lại danh sách
        </Button>
      </div>
    )
  }

  const { exam, user_answers } = data
  const globalAudioUrl = getGlobalAudioUrl(exam)

  return (
    <div className="mx-auto max-w-[1650px]">
      <section className="overflow-hidden rounded-[36px] border border-border bg-card shadow-xl shadow-slate-200/50">
        
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-6 sm:px-8">
          <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <div className="flex min-w-0 items-center gap-4">
              <Button asChild variant="ghost" size="icon" className="rounded-full">
                <Link to="/history">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="min-w-0">
                <p className="truncate text-base font-black tracking-tight text-teal-950">{exam.title} (Xem lại)</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Hoàn thành lúc: {new Date(data.completed_at).toLocaleString('vi-VN')}</span>
                  <span>·</span>
                  <span>{exam.total_questions} câu</span>
                </div>
              </div>
            </div>

            <div className="justify-self-start lg:justify-self-center">
              <div className="flex items-center gap-6 text-slate-700">
                <div className="text-center">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Điểm IRT</p>
                  <p className="text-2xl font-black text-indigo-600">{data.score.toFixed(2)}</p>
                </div>
                <div className="h-10 w-px bg-slate-200"></div>
                <div className="text-center">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Số câu đúng</p>
                  <p className="text-2xl font-black text-emerald-600">{data.correct_answers}/{data.total_questions}</p>
                </div>
              </div>
            </div>

            <div className="justify-self-start lg:justify-self-end hidden lg:flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAnalysis(true)}
                className="rounded-full border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold transition-all shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Phân tích học tập (AI)
              </Button>
              <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${
                data.score <= 19 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {data.score <= 19 ? 'KHÔNG ĐẠT' : 'ĐẠT (PASS)'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#f6f7ff] px-6 py-8 sm:px-8 sm:py-10">
          <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[245px_minmax(0,1fr)]">
            
            {/* Sidebar Navigation */}
            <aside className="space-y-6">
              <div className="space-y-7">
                {groupedQuestions.map((group, groupIndex) => (
                  <section key={group.label}>
                    <div className="mb-4 flex items-center gap-3">
                      <span className={['block h-9 w-1 rounded-full', groupIndex === 0 ? 'bg-orange-400' : 'bg-slate-400'].join(' ')} />
                      <div className="text-sm font-black text-foreground">{group.label}</div>
                    </div>

                    <div className="grid grid-cols-4 gap-y-2.5 gap-x-1.5">
                      {group.questions.map((question) => {
                        const isCurrentActive = question.question_id === activeQuestionId
                        const selectedAnswerId = user_answers[question.question_id]
                        const isCorrect = selectedAnswerId && question.answers.find(a => a.answer_id === selectedAnswerId)?.is_correct

                        const toneClass = isCurrentActive
                          ? 'border-2 border-blue-400 bg-card shadow-lg shadow-blue-100/50 scale-110 !font-black !text-blue-700 z-10'
                          : !selectedAnswerId 
                            ? 'bg-slate-200 text-muted-foreground opacity-60'
                            : isCorrect 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                              : 'bg-rose-100 text-rose-700 border border-rose-300'

                        return (
                          <button
                            key={question.question_id}
                            type="button"
                            onClick={() => setActiveQuestionId(question.question_id)}
                            className={['relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold transition-all', toneClass].join(' ')}
                          >
                            {question.question_number || '?'}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </aside>

            {/* Main Question Display */}
            <main className="min-w-0">
              <div className="space-y-6">
                <div className="rounded-[28px] border border-border bg-card px-6 py-6 shadow-sm relative overflow-hidden">
                  
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <span className="rounded-xl bg-blue-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-blue-700 sm:text-xs">
                        {activeGroup}
                      </span>
                      <span className="text-lg font-black text-foreground sm:text-xl">
                        Câu {activeQuestion.question_number || '?'}
                      </span>
                    </div>

                    {/* Verification Status Badge */}
                    {(() => {
                      const selAns = user_answers[activeQuestion.question_id]
                      if (!selAns) return <div className="px-3 py-1 bg-slate-100 text-muted-foreground rounded-lg text-xs font-semibold">Chưa làm</div>
                      const isK = activeQuestion.answers.find(a => a.answer_id === selAns)?.is_correct
                      return isK 
                        ? <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold"><CheckCircle2 className="w-4 h-4"/> ĐÚNG</div>
                        : <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold"><XCircle className="w-4 h-4"/> SAI</div>
                    })()}
                  </div>

                  {/* Show specific audio or fallback to whole audio manual play */}
                  {(activeQuestion.audio_clip_url || globalAudioUrl) && (
                    <div className="mb-6">
                      <TestAudioPlayer
                        compact
                        title="Nghe lại câu hỏi"
                        url={activeQuestion.audio_clip_url || globalAudioUrl}
                        mode="practice" /* Forcing practice in Review page to allow manual playback controls */
                        autoPlaySignal={0}
                      />
                    </div>
                  )}

                  <div className="rounded-[24px] border border-border bg-slate-50 px-6 py-6 shadow-inner relative">
                    <p className="text-base leading-[1.7] text-foreground sm:text-lg">
                      {activeQuestion.question_text || 'Câu hỏi chưa có nội dung chữ'}
                    </p>
                  </div>

                  {activeQuestion.image_url && (
                    <div className="mt-6 overflow-hidden rounded-[24px] border border-border bg-card">
                      <img
                        src={activeQuestion.image_url}
                        alt={`Question ${activeQuestion.question_number}`}
                        className="h-auto max-h-[420px] w-full object-contain"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {activeQuestion.answers.map((answer, index) => {
                    const isSelected = user_answers[activeQuestion.question_id] === answer.answer_id
                    const isCorrectAnswer = answer.is_correct

                    let cardClass = 'border-border bg-card text-muted-foreground'
                    let indexClass = 'border-border text-muted-foreground'
                    
                    if (isCorrectAnswer && isSelected) {
                      cardClass = 'border-emerald-400 bg-emerald-50/50 shadow-md shadow-emerald-100/50'
                      indexClass = 'border-emerald-500 bg-emerald-500 text-white'
                    } else if (isCorrectAnswer && !isSelected) {
                      cardClass = 'border-emerald-400 bg-emerald-50 shadow-sm border-dashed'
                      indexClass = 'border-emerald-500 text-emerald-600 bg-emerald-100'
                    } else if (!isCorrectAnswer && isSelected) {
                      cardClass = 'border-rose-300 bg-rose-50 shadow-md shadow-rose-100/50'
                      indexClass = 'border-rose-500 bg-rose-500 text-white'
                    }

                    return (
                      <div
                        key={answer.answer_id}
                        className={['flex w-full items-center gap-5 rounded-[28px] border px-6 py-5 text-left transition-all', cardClass].join(' ')}
                      >
                        <span className={['inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 text-xs font-black relative', indexClass].join(' ')}>
                          {index + 1}
                          {isCorrectAnswer && isSelected && <CheckCircle2 className="absolute -right-2 -top-2 w-5 h-5 text-emerald-500 bg-card rounded-full" />}
                          {!isCorrectAnswer && isSelected && <XCircle className="absolute -right-2 -top-2 w-5 h-5 text-rose-500 bg-card rounded-full" />}
                        </span>
                        
                        <div className="flex-1">
                          <p className={`text-sm leading-[1.6] sm:text-base ${isCorrectAnswer ? 'text-emerald-900 font-medium' : isSelected ? 'text-rose-900' : 'text-slate-700'}`}>
                            {answer.content || 'Đáp án dạng hình ảnh'}
                          </p>
                          {answer.image_url && (
                            <img
                              src={answer.image_url}
                              alt={`Answer ${index + 1}`}
                              className="mt-4 max-h-40 rounded-2xl border border-border object-contain"
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {(activeQuestion.script_text || activeQuestion.explanation) && (
                  <div className="space-y-5 pt-4 border-t border-slate-200/60 mt-6">
                    {activeQuestion.script_text && (
                      <div className="rounded-[24px] border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-blue-800">
                          <FileText className="h-4 w-4" />
                          Audio Script
                        </h4>
                        <div className="prose prose-sm prose-slate max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                          {activeQuestion.script_text}
                        </div>
                      </div>
                    )}
                    
                    {activeQuestion.explanation && (
                      <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/50 p-6 shadow-sm">
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-indigo-800">
                          <Brain className="h-4 w-4" />
                          Lời giải thích
                        </h4>
                        <div className="prose prose-sm prose-slate max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                          {activeQuestion.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="border-t border-border bg-card px-6 py-5 sm:px-8">
          <div className="grid items-center gap-4 lg:grid-cols-[160px_minmax(0,1fr)_160px]">
            <div className="justify-self-start">
              <button
                type="button"
                onClick={() => moveQuestion(-1)}
                disabled={activeIndex <= 0}
                className="inline-flex h-12 w-24 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                disabled={activeIndex >= exam.total_questions - 1}
                className="inline-flex h-12 w-24 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {showAnalysis && resultId && (
        <CompetencyAnalysisModal
          resultId={resultId}
          onClose={() => setShowAnalysis(false)}
        />
      )}
    </div>
  )
}
