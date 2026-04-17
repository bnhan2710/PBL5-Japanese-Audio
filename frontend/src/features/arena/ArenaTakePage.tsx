import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2, Swords } from 'lucide-react'

import { TakeExamContent } from '@/features/test/TakeExamPage'
import { arenaClient, type ArenaContest } from './arenaClient'
import type { TestExamDetail, TestSubmitPayload, TestSubmitResult } from '@/features/test/types'

export default function ArenaTakePage() {
  const { contestId = '' } = useParams()
  const [contest, setContest] = useState<ArenaContest | null>(null)
  const [exam, setExam] = useState<TestExamDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    arenaClient
      .getContestTakeData(contestId)
      .then((data) => {
        setContest(data.contest)
        setExam(data.exam)
      })
      .catch((err: Error) => setError(err.message || 'Không thể tải phòng thi Arena'))
      .finally(() => setLoading(false))
  }, [contestId])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    )
  }

  if (error || !contest || !exam) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-red-50 px-8 py-10 text-center">
        <p className="text-lg font-semibold text-red-700">{error || 'Không tìm thấy phòng thi'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-orange-200 bg-gradient-to-r from-orange-100 via-amber-50 to-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
              <Swords className="h-4 w-4" />
              Arena Match
            </div>
            <h1 className="text-3xl font-black text-foreground">{contest.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Giao diện thi đấu Arena tách riêng với view làm đề thi thường. Bạn đang vào phòng thi
              với đề: {contest.exam_title}.
            </p>
          </div>
          <Link
            to={`/arena/${contest.contest_id}`}
            className="text-sm font-semibold text-orange-700 underline-offset-4 hover:underline"
          >
            Quay lại chi tiết cuộc thi
          </Link>
        </div>
      </section>

      <TakeExamContent
        examId={exam.exam_id}
        initialExam={exam}
        initialAudioMode="simulation"
        standalone
        variant="arena"
        returnPath={`/arena/${contest.contest_id}`}
        submitExam={(payload: TestSubmitPayload) =>
          arenaClient.submitContest(contest.contest_id, payload).then((data) => {
            setContest(data.contest)
            return data.submission as TestSubmitResult
          })
        }
      />
    </div>
  )
}
