import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock3, Download, FileBadge2, Loader2 } from 'lucide-react'

import { examClient, ExamResponse, QuestionResponse } from './api/examClient'

type GroupedQuestions = Record<string, QuestionResponse[]>
const PRINT_FONT_STACK = '"Noto Sans JP", "Fira Sans", system-ui, sans-serif'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDuration(value?: number) {
  if (!value) return 'Không giới hạn'
  return `${value} phút`
}

function buildCloudinaryDownloadUrl(value?: string | null) {
  if (!value) return null
  if (value.includes('res.cloudinary.com') && value.includes('/upload/')) {
    return value.replace('/upload/', '/upload/fl_attachment/')
  }
  return value
}

function extractFileName(value?: string | null) {
  if (!value) return 'audio-listening.mp3'
  const normalized = value.split('?')[0]?.split('#')[0] ?? value
  const segments = normalized.split('/')
  return segments[segments.length - 1] || 'audio-listening.mp3'
}

function shortenFileName(value: string, maxLength = 32) {
  if (value.length <= maxLength) return value

  const dotIndex = value.lastIndexOf('.')
  const extension = dotIndex > 0 ? value.slice(dotIndex) : ''
  const nameWithoutExtension = dotIndex > 0 ? value.slice(0, dotIndex) : value
  const availableLength = Math.max(8, maxLength - extension.length - 3)

  if (nameWithoutExtension.length <= availableLength) {
    return `${nameWithoutExtension}${extension}`
  }

  const startLength = Math.ceil(availableLength / 2)
  const endLength = Math.floor(availableLength / 2)
  return `${nameWithoutExtension.slice(0, startLength)}...${nameWithoutExtension.slice(-endLength)}${extension}`
}

function buildQrCodeUrl(value: string) {
  const searchParams = new URLSearchParams({
    size: '220x220',
    data: value,
  })
  return `https://api.qrserver.com/v1/create-qr-code/?${searchParams.toString()}`
}

function sortQuestions(questions: QuestionResponse[]) {
  return [...questions].sort((a, b) => {
    const groupCompare = (a.mondai_group || '').localeCompare(b.mondai_group || '')
    if (groupCompare !== 0) return groupCompare
    return (a.question_number || 0) - (b.question_number || 0)
  })
}

function groupQuestions(questions: QuestionResponse[]): GroupedQuestions {
  return sortQuestions(questions).reduce<GroupedQuestions>((acc, question) => {
    const key = question.mondai_group || 'Phần khác'
    if (!acc[key]) acc[key] = []
    acc[key].push(question)
    return acc
  }, {})
}

function normalizePrintText(value?: string | null) {
  if (!value) return ''

  return value
    .replace(
      /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff00-\uffefー])[\t ]+([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff00-\uffefー])/gu,
      '$1$2'
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getListeningFile(exam: ExamResponse, questions: QuestionResponse[]) {
  const baseUrl =
    exam.audio_file_url || questions.find((question) => question.audio_clip_url)?.audio_clip_url
  if (!baseUrl) return null

  const downloadUrl = buildCloudinaryDownloadUrl(baseUrl) || baseUrl
  return {
    fileName: exam.audio_file_name || extractFileName(downloadUrl),
    url: downloadUrl,
    qrCodeUrl: buildQrCodeUrl(downloadUrl),
  }
}

export default function ExamPrintPage() {
  const { examId } = useParams<{ examId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [exam, setExam] = useState<ExamResponse | null>(null)
  const [questions, setQuestions] = useState<QuestionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasTriggeredPrint, setHasTriggeredPrint] = useState(false)

  useEffect(() => {
    if (!exam?.title) return

    const previousTitle = document.title
    document.title = exam.title

    return () => {
      document.title = previousTitle
    }
  }, [exam?.title])

  useEffect(() => {
    if (!examId) {
      setError('Không tìm thấy mã đề thi')
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([examClient.getExam(examId), examClient.getExamQuestions(examId)])
      .then(([examData, questionData]) => {
        setExam(examData)
        setQuestions(sortQuestions(questionData))
      })
      .catch((err: Error) => {
        setError(err.message || 'Không thể tải dữ liệu đề thi')
      })
      .finally(() => setLoading(false))
  }, [examId])

  useEffect(() => {
    const shouldAutoPrint = searchParams.get('autoprint') === '1'
    if (!shouldAutoPrint || loading || error || !exam || hasTriggeredPrint) return

    const timer = window.setTimeout(() => {
      window.print()
      setHasTriggeredPrint(true)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [searchParams, loading, error, exam, hasTriggeredPrint])

  const groupedQuestions = useMemo(() => groupQuestions(questions), [questions])
  const listeningFile = useMemo(
    () => (exam ? getListeningFile(exam, questions) : null),
    [exam, questions]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-6 py-4 text-stone-700 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-rose-500" />
          Đang chuẩn bị bản PDF đề thi...
        </div>
      </div>
    )
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center px-6">
        <div className="max-w-lg rounded-3xl border border-rose-200 bg-card p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-rose-500">
            PDF Exam
          </p>
          <h1 className="mt-3 text-2xl font-bold text-stone-900">Không thể mở đề thi</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {error || 'Dữ liệu đề thi không hợp lệ'}
          </p>
          <button
            onClick={() => navigate('/exam')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại danh sách đề thi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#f8f4ee_0%,#efe6dc_100%)] py-8 text-stone-900 print:bg-card print:py-0"
      style={{ fontFamily: PRINT_FONT_STACK }}
    >
      <style>{`
 @page {
 size: A4;
 margin: 14mm;
 }

 @media print {
 body {
 background: white !important;
 }

 .print-hidden {
 display: none !important;
 }

 .print-sheet {
 box-shadow: none !important;
 border: none !important;
 margin: 0 !important;
 max-width: none !important;
 }

 .page-break {
 break-before: page;
 }

 .question-block,
 .group-block,
 .answer-card {
 break-inside: avoid;
 }

 .audio-access-card {
 break-inside: avoid;
 }
 }
 `}</style>

      <div className="print-hidden mx-auto mb-6 flex max-w-5xl items-center justify-between px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
            Exam PDF Studio
          </p>
          <h1 className="mt-2 text-2xl font-bold text-stone-900">Xuất đề thi sang PDF</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trang này được tối ưu để dùng tính năng Save as PDF của trình duyệt.
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Nếu còn hiện URL ở mép trang khi in, hãy bỏ chọn mục{' '}
            <span className="font-semibold">Headers and footers</span> trong hộp thoại in của trình
            duyệt.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/exam"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-card px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            <Download className="h-4 w-4" />
            Tải PDF
          </button>
        </div>
      </div>

      <main className="print-sheet mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-border bg-card shadow-[0_30px_80px_rgba(120,83,50,0.15)]">
        <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(circle_at_top_left,#f97316_0,#fb7185_48%,#fff7ed_100%)] px-8 py-10 text-white">
          <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.25),transparent_70%)]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
              Japanese Listening Exam
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight">{exam.title}</h1>
            {exam.description && (
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/90">{exam.description}</p>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/30 bg-card/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                  Thời lượng
                </p>
                <p className="mt-2 flex items-center gap-2 text-base font-semibold">
                  <Clock3 className="h-4 w-4" />
                  {formatDuration(exam.time_limit)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/30 bg-card/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                  Số câu hỏi
                </p>
                <p className="mt-2 text-base font-semibold">{questions.length} câu</p>
              </div>
              <div className="rounded-2xl border border-white/30 bg-card/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                  Ngày tạo
                </p>
                <p className="mt-2 flex items-center gap-2 text-base font-semibold">
                  <FileBadge2 className="h-4 w-4" />
                  {formatDate(exam.created_at)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-stone-50 px-8 py-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-stone-500">
            Hướng dẫn
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-stone-900">1. Nghe kỹ đoạn audio</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Mỗi câu hỏi được thiết kế cho kỹ năng nghe hiểu tiếng Nhật theo từng phần mondai.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-stone-900">2. Chọn một đáp án đúng nhất</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Đề in ra giữ khoảng trắng hợp lý để người làm bài dễ đọc và ghi chú trực tiếp.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-stone-900">
                3. Đối chiếu đáp án ở cuối file
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Phần đáp án được tách riêng giúp dùng chung cho cả bản thi và bản chấm.
              </p>
            </div>
          </div>
        </section>

        {listeningFile && (
          <section className="border-b border-border bg-[linear-gradient(135deg,#fff8f1_0%,#fffdf9_55%,#eefbf5_100%)] px-8 py-7">
            <div className="audio-access-card grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_240px]">
              <div className="rounded-[28px] border border-amber-200 bg-card/90 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-500">
                  Audio Access
                </p>
                <h2 className="mt-3 text-2xl font-bold text-stone-900">QR + URL file nghe</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Quét mã QR hoặc dùng URL bên dưới để mở trực tiếp file nghe và tải về khi in/xuất
                  PDF đề thi.
                </p>

                <div className="mt-5 rounded-2xl border border-border bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                    Tên file
                  </p>
                  <p className="mt-2 max-w-full truncate text-base font-semibold text-stone-900" title={listeningFile.fileName}>
                    {shortenFileName(listeningFile.fileName, 34)}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-stone-950 px-4 py-4 text-stone-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
                    URL tải file nghe
                  </p>
                  <p className="mt-3 break-all font-mono text-xs leading-6 text-stone-100">
                    {listeningFile.url}
                  </p>
                </div>

                <div className="print-hidden mt-4 flex flex-wrap gap-3">
                  <a
                    href={listeningFile.url}
                    target="_blank"
                    rel="noreferrer"
                    download={listeningFile.fileName}
                    className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                  >
                    <Download className="h-4 w-4" />
                    Mở / tải file nghe
                  </a>
                </div>
              </div>

              <div className="rounded-[28px] border border-emerald-200 bg-white p-5 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                  Scan To Listen
                </p>
                <div className="mt-4 overflow-hidden rounded-3xl border border-emerald-100 bg-white p-3">
                  <img
                    src={listeningFile.qrCodeUrl}
                    alt="Mã QR mở file nghe"
                    className="mx-auto aspect-square w-full max-w-[220px] object-contain"
                  />
                </div>
                <p className="mt-4 text-sm font-semibold text-stone-900">
                  Quét mã QR để mở file nghe
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Nếu trình duyệt không tải trực tiếp, hãy mở URL và dùng chức năng tải xuống của
                  trình phát.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="px-8 py-8">
          <div className="space-y-8">
            {Object.entries(groupedQuestions).map(([groupName, groupQuestions], groupIndex) => (
              <section key={groupName} className="group-block">
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-500">
                      Phần {groupIndex + 1}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-stone-900">{groupName}</h2>
                  </div>
                  <p className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {groupQuestions.length} câu hỏi
                  </p>
                </div>

                <div className="space-y-5">
                  {groupQuestions.map((question) => {
                    const correctAnswerIndex = question.answers.findIndex(
                      (answer) => answer.is_correct
                    )

                    return (
                      <article
                        key={question.question_id}
                        className="question-block rounded-[28px] border border-border bg-[linear-gradient(180deg,#fffefb_0%,#fff8f1_100%)] p-6"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
                              Question
                            </p>
                            <h3 className="mt-2 text-xl font-bold text-stone-900">
                              Câu {question.question_number ?? '?'}
                            </h3>
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="text-sm font-semibold text-stone-900">Nội dung câu hỏi</p>
                          <p className="mt-2 whitespace-pre-line text-base leading-8 tracking-normal text-stone-700">
                            {normalizePrintText(question.question_text) ||
                              'Chưa có nội dung câu hỏi'}
                          </p>
                        </div>

                        {question.image_url && (
                          <div className="mt-5">
                            <img
                              src={question.image_url}
                              alt={`Hình minh họa cho câu ${question.question_number}`}
                              className="max-h-80 rounded-2xl border border-border object-contain"
                            />
                          </div>
                        )}

                        <div className="mt-6 grid gap-3">
                          {question.answers.map((answer, answerIndex) => (
                            <div
                              key={answer.answer_id}
                              className="answer-card flex items-start gap-4 rounded-2xl border border-border bg-card px-4 py-3"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-bold text-white">
                                {String.fromCharCode(65 + answerIndex)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="whitespace-pre-line text-sm leading-7 tracking-normal text-stone-700">
                                  {normalizePrintText(answer.content) ||
                                    '.................................'}
                                </p>
                                {answer.image_url && (
                                  <img
                                    src={answer.image_url}
                                    alt={`Đáp án ${String.fromCharCode(65 + answerIndex)} câu ${question.question_number}`}
                                    className="mt-3 max-h-52 rounded-2xl border border-border object-contain"
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-xs text-stone-200">
                          <span>Mã câu hỏi: {question.question_id}</span>
                          <span>
                            Đáp án đúng:{' '}
                            {correctAnswerIndex >= 0
                              ? String.fromCharCode(65 + correctAnswerIndex)
                              : 'Chưa thiết lập'}
                          </span>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="page-break border-t border-dashed border-stone-300 bg-stone-50 px-8 py-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
                Appendix
              </p>
              <h2 className="mt-2 text-2xl font-bold text-stone-900">
                Script, giải thích và đáp án
              </h2>
            </div>
            <div className="rounded-full bg-card px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
              {questions.length} câu
            </div>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedQuestions).map(([groupName, groupQuestions]) => (
              <section key={groupName} className="rounded-[28px] border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-stone-900">{groupName}</h3>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {groupQuestions.length} câu
                  </span>
                </div>

                <div className="mt-5 space-y-5">
                  {groupQuestions.map((question) => {
                    const correctAnswerIndex = question.answers.findIndex(
                      (answer) => answer.is_correct
                    )

                    return (
                      <article
                        key={question.question_id}
                        className="rounded-[24px] border border-border bg-stone-50 p-5"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-semibold text-stone-900">
                            Câu {question.question_number ?? '?'}
                          </p>
                          <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-bold text-white">
                            Đáp án đúng:{' '}
                            {correctAnswerIndex >= 0
                              ? String.fromCharCode(65 + correctAnswerIndex)
                              : 'Chưa thiết lập'}
                          </span>
                        </div>

                        {question.script_text && (
                          <div className="mt-4 rounded-2xl border border-border bg-card px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                              Script
                            </p>
                            <p className="mt-3 whitespace-pre-line text-sm leading-7 tracking-normal text-stone-700">
                              {normalizePrintText(question.script_text)}
                            </p>
                          </div>
                        )}

                        {question.explanation && (
                          <div className="mt-4 rounded-2xl border border-border bg-card px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                              Giải thích
                            </p>
                            <p className="mt-3 whitespace-pre-line text-sm leading-7 tracking-normal text-stone-700">
                              {normalizePrintText(question.explanation)}
                            </p>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="page-break border-t border-dashed border-stone-300 bg-stone-50 px-8 py-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
                Answer Key
              </p>
              <h2 className="mt-2 text-2xl font-bold text-stone-900">Bảng đáp án</h2>
            </div>
            <div className="rounded-full bg-card px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
              {questions.length} câu
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(groupedQuestions).map(([groupName, groupQuestions]) => (
              <section key={groupName} className="rounded-[28px] border border-border bg-card p-5">
                <h3 className="text-lg font-bold text-stone-900">{groupName}</h3>
                <div className="mt-4 space-y-2">
                  {groupQuestions.map((question) => {
                    const correctAnswerIndex = question.answers.findIndex(
                      (answer) => answer.is_correct
                    )

                    return (
                      <div
                        key={question.question_id}
                        className="flex items-center justify-between rounded-2xl border border-border bg-stone-50 px-4 py-3 text-sm"
                      >
                        <span className="font-medium text-stone-700">
                          Câu {question.question_number ?? '?'}
                        </span>
                        <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-bold text-white">
                          {correctAnswerIndex >= 0
                            ? String.fromCharCode(65 + correctAnswerIndex)
                            : 'N/A'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
