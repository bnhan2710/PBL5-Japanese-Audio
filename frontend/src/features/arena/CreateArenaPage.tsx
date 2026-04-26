import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Swords,
  Timer,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/input'
import { examClient, type ExamResponse } from '@/features/exam/api/examClient'
import { arenaClient, getArenaStatus, type JLPTLevel } from './arenaClient'

type Step = 1 | 2 | 3

const levelOptions: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

function toLocalDatetimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function toApiLocalDateTime(value: string) {
  return value.length === 16 ? `${value}:00` : value
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CreateArenaPage() {
  const { contestId } = useParams<{ contestId: string }>()
  const navigate = useNavigate()
  const isEditMode = !!contestId

  const [step, setStep] = useState<Step>(1)
  const [myExams, setMyExams] = useState<ExamResponse[]>([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingExams, setLoadingExams] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [maxDuration, setMaxDuration] = useState(45)
  const [minLevel, setMinLevel] = useState<JLPTLevel>('N3')
  const [startAt, setStartAt] = useState(
    toLocalDatetimeValue(new Date(Date.now() + 60 * 60 * 1000))
  )
  const [endAt, setEndAt] = useState(
    toLocalDatetimeValue(new Date(Date.now() + 2 * 60 * 60 * 1000))
  )
  const [maxParticipants, setMaxParticipants] = useState('50')

  useEffect(() => {
    const loadData = async () => {
      setLoadingInitial(true)
      try {
        // Load exams
        const exams = await examClient.listExams(true)
        setMyExams(exams)

        if (isEditMode && contestId) {
          // Load contest data
          const contest = await arenaClient.getContest(contestId)
          setTitle(contest.title)
          setDescription(contest.description || '')
          setMinLevel(contest.min_jlpt_level)
          setMaxDuration(contest.time_limit)
          setStartAt(toLocalDatetimeValue(new Date(contest.start_time)))
          setEndAt(toLocalDatetimeValue(new Date(contest.end_time)))
          setMaxParticipants(contest.max_participants?.toString() || '')
          setSelectedExamId(contest.exam_id)
        } else if (exams[0]) {
          setSelectedExamId(exams[0].exam_id)
        }
      } catch (err: any) {
        setError(err.message || 'Không thể tải dữ liệu')
      } finally {
        setLoadingInitial(false)
        setLoadingExams(false)
      }
    }

    loadData()
  }, [contestId, isEditMode])

  const selectedExam = useMemo(
    () => myExams.find((exam) => exam.exam_id === selectedExamId) ?? null,
    [myExams, selectedExamId]
  )

  const previewStatus = useMemo(
    () =>
      getArenaStatus({
        start_time: toApiLocalDateTime(startAt),
        end_time: toApiLocalDateTime(endAt),
      }),
    [endAt, startAt]
  )

  const stepOneValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    maxDuration > 0 &&
    !!startAt &&
    !!endAt &&
    new Date(endAt).getTime() > new Date(startAt).getTime()

  const stepTwoValid = !!selectedExam

  const handleSave = async () => {
    if (!selectedExam || !stepOneValid) return

    setSaving(true)
    setError('')

    const payload = {
      title: title.trim(),
      description: description.trim(),
      min_jlpt_level: minLevel,
      time_limit: maxDuration,
      start_time: toApiLocalDateTime(startAt),
      end_time: toApiLocalDateTime(endAt),
      max_participants: maxParticipants ? Number(maxParticipants) : undefined,
      exam_id: selectedExam.exam_id,
    }

    try {
      if (isEditMode && contestId) {
        await arenaClient.updateContest(contestId, payload)
        navigate(`/arena/${contestId}`)
      } else {
        const contest = await arenaClient.createContest(payload)
        navigate(`/arena/${contest.contest_id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu cuộc thi')
    } finally {
      setSaving(false)
    }
  }

  if (loadingInitial) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        <p className="text-sm text-muted-foreground">Đang tải cấu hình cuộc thi...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-2">
      <div className="rounded-[28px] border border-orange-200/70 bg-gradient-to-r from-orange-100 via-amber-50 to-white p-8 shadow-sm dark:border-orange-900/40 dark:from-orange-950/30 dark:via-amber-950/10 dark:to-background">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
          JLPT Ranking Arena
        </p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">
          {isEditMode ? 'Chỉnh sửa cuộc thi' : 'Tạo cuộc thi mới'}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          {isEditMode
            ? 'Cập nhật lại thông tin, thời gian hoặc thay đổi đề thi cho Arena này.'
            : 'Luồng tạo contest gồm 3 bước: cấu hình cuộc thi, chọn một đề trong kho đề của tôi và kiểm tra lại toàn bộ trước khi mở phòng thi.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { id: 1, title: 'Thiết lập cuộc thi', icon: Timer },
          { id: 2, title: 'Chọn đề thi', icon: ClipboardList },
          { id: 3, title: 'Xem lại', icon: CheckCircle2 },
        ].map((item) => {
          const active = step === item.id
          const done = step > item.id

          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 transition-colors ${
                active
                  ? 'border-orange-400 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/20'
                  : done
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/20'
                    : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/90 p-2 dark:bg-background/60">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bước {item.id}</p>
                  <p className="font-semibold text-foreground">{item.title}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Thiết lập cuộc thi</CardTitle>
            <CardDescription>
              Thông tin cơ bản, khung thời gian làm bài của cuộc thi.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Tên cuộc thi</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Arena luyện nghe N2 tối thứ 6"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Thông tin cuộc thi</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả luật thi, cách tham gia hoặc mục tiêu luyện tập"
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Thời gian làm bài tối đa</label>
              <Input
                type="number"
                min={1}
                value={maxDuration}
                onChange={(e) => setMaxDuration(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Trình độ JLPT tối thiểu</label>
              <select
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value as JLPTLevel)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {levelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Thời gian bắt đầu</label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Thời gian kết thúc</label>
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Số lượng tham gia tối đa</label>
              <Input
                type="number"
                min={1}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                placeholder="Để trống nếu không giới hạn"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Chọn đề thi</CardTitle>
            <CardDescription>
              Người dùng chỉ chọn trong những đề đã tạo ở mục Đề thi của tôi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingExams ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-40 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : myExams.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
                <p className="text-lg font-semibold">Bạn chưa có đề thi nào để dùng cho Arena</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Hãy tạo đề thi trước rồi quay lại bước này.
                </p>
                <Button className="mt-5" onClick={() => navigate('/exam/create')}>
                  Đi tới tạo đề thi
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {myExams.map((exam) => {
                  const selected = exam.exam_id === selectedExamId
                  return (
                    <button
                      key={exam.exam_id}
                      type="button"
                      onClick={() => setSelectedExamId(exam.exam_id)}
                      className={`rounded-2xl border p-5 text-left transition-all ${
                        selected
                          ? 'border-orange-400 bg-orange-50 shadow-sm dark:border-orange-700 dark:bg-orange-950/20'
                          : 'border-border bg-card hover:border-orange-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-foreground">
                            {exam.title || 'Đề chưa đặt tên'}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {exam.description || 'Đề thi không có mô tả.'}
                          </p>
                        </div>
                        {selected ? <CheckCircle2 className="h-5 w-5 text-orange-600" /> : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{exam.time_limit ?? 0} phút</span>
                        <span>{exam.is_published ? 'Đã xuất bản' : 'Bản nháp'}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Xem lại cấu hình</CardTitle>
              <CardDescription>
                Kiểm tra thông tin cuộc thi, đề thi được chọn và trạng thái dự kiến trước khi lưu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Tên cuộc thi</p>
                  <p className="mt-1 font-semibold text-foreground">{title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Thời gian làm bài tối đa</p>
                  <p className="mt-1 font-semibold text-foreground">{maxDuration} phút</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Trình độ tối thiểu</p>
                  <p className="mt-1 font-semibold text-foreground">{minLevel}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bắt đầu</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatDateTime(toApiLocalDateTime(startAt))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kết thúc</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatDateTime(toApiLocalDateTime(endAt))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Số lượng tối đa</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {maxParticipants || 'Không giới hạn'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tag trạng thái dự kiến</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {arenaClient.getStatusLabel(previewStatus)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/40 p-5">
                <p className="text-sm text-muted-foreground">Thông tin cuộc thi</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">
                  {description}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Đề thi đã chọn</CardTitle>
              <CardDescription>Contest sẽ dùng đúng một đề ở bước chọn đề thi.</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedExam ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 dark:border-orange-900/40 dark:bg-orange-950/20">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <Swords className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                      Arena Exam
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    {selectedExam.title || 'Đề chưa đặt tên'}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedExam.description || 'Đề thi không có mô tả.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{selectedExam.time_limit ?? 0} phút</span>
                    <span>{selectedExam.is_published ? 'Đã xuất bản' : 'Bản nháp'}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa chọn đề thi.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => (step === 1 ? navigate('/arena') : setStep((step - 1) as Step))}
        >
          <ChevronLeft className="h-4 w-4" />
          {step === 1 ? 'Quay lại Arena' : 'Bước trước'}
        </Button>

        <div className="flex gap-3">
          {step < 3 ? (
            <Button
              onClick={() => setStep((step + 1) as Step)}
              disabled={(step === 1 && !stepOneValid) || (step === 2 && !stepTwoValid)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Bước tiếp theo
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={!stepOneValid || !stepTwoValid || saving}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEditMode ? (
                'Cập nhật cuộc thi'
              ) : (
                'Tạo cuộc thi'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
