import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, CheckCircle2, Clock3, LockKeyhole, Medal, PlayCircle, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { arenaClient, getArenaStatus, type ArenaContest } from './arenaClient'

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function avatarFallback(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

export default function ArenaDetailPage() {
  const { contestId = '' } = useParams()
  const navigate = useNavigate()
  const [contest, setContest] = useState<ArenaContest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    arenaClient
      .getContest(contestId)
      .then((data) => {
        if (!data) {
          setError('Không tìm thấy cuộc thi')
          return
        }
        setContest(data)
      })
      .catch((err: Error) => setError(err.message || 'Không thể tải chi tiết cuộc thi'))
      .finally(() => setLoading(false))
  }, [contestId])

  const status = useMemo(() => (contest ? getArenaStatus(contest) : 'upcoming'), [contest])
  const canJoin = !!contest && (status === 'upcoming' || status === 'ongoing')
  const canCompete = !!contest && contest.joined && status === 'ongoing' && !contest.result_id
  const podium = contest?.leaderboard.slice(0, 3) ?? []
  const rankingList = contest?.leaderboard.slice(3) ?? []

  const handleJoin = async () => {
    if (!contest || !canJoin) return

    const updated = await arenaClient.joinContest(contest.contest_id)
    if (updated) setContest(updated)
  }

  if (loading) {
    return <div className="h-80 animate-pulse rounded-3xl bg-muted" />
  }

  if (!contest) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-12 text-center text-red-700">
        {error || 'Không tìm thấy cuộc thi'}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-2">
      <section className="overflow-hidden rounded-[28px] border border-orange-200/70 bg-gradient-to-br from-orange-100 via-amber-50 to-white dark:border-orange-900/40 dark:from-orange-950/30 dark:via-amber-950/10 dark:to-background">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${arenaClient.getStatusClasses(
                status
              )}`}
            >
              {arenaClient.getStatusLabel(status)}
            </span>
            <h1 className="mt-4 text-3xl font-bold text-foreground">{contest.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
              {contest.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {contest.joined ? (
                <>
                  <Button variant="outline" disabled>
                    <CheckCircle2 className="h-4 w-4" />
                    Đã tham gia
                  </Button>
                  {canCompete ? (
                    <Button
                      className="bg-orange-600 hover:bg-orange-700"
                      onClick={() => navigate(`/arena/${contest.contest_id}/take`)}
                    >
                      <PlayCircle className="h-4 w-4" />
                      Thi đấu
                    </Button>
                  ) : null}
                  {contest.result_id ? (
                    <Button variant="outline" disabled>
                      <PlayCircle className="h-4 w-4" />
                      Đã thi đấu
                    </Button>
                  ) : null}
                </>
              ) : canJoin ? (
                <Button className="bg-orange-600 hover:bg-orange-700" onClick={handleJoin}>
                  <PlayCircle className="h-4 w-4" />
                  Tham gia cuộc thi
                </Button>
              ) : (
                <Button disabled>
                  <LockKeyhole className="h-4 w-4" />
                  Cuộc thi đã hết hạn
                </Button>
              )}
              <Link to="/arena">
                <Button variant="outline">Quay lại danh sách</Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-card/60">
              <p className="text-sm text-muted-foreground">Đề thi sử dụng</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{contest.exam_title}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-card/60">
              <p className="text-sm text-muted-foreground">Chế độ thi</p>
              <p className="mt-2 text-lg font-semibold text-foreground">Phòng thi</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Thông tin cuộc thi</CardTitle>
            <CardDescription>
              Người dùng có thể tham gia khi contest đang diễn ra hoặc sắp diễn ra. Contest đã hết
              hạn chỉ còn xem thông tin.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4 text-orange-500" />
                Bắt đầu
              </div>
              <p className="mt-2 font-semibold text-foreground">{formatDateTime(contest.start_time)}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4 text-orange-500" />
                Kết thúc
              </div>
              <p className="mt-2 font-semibold text-foreground">{formatDateTime(contest.end_time)}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4 text-orange-500" />
                Thời gian làm bài tối đa
              </div>
              <p className="mt-2 font-semibold text-foreground">
                {contest.time_limit} phút
              </p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4 text-orange-500" />
                Trình độ JLPT tối thiểu
              </div>
              <p className="mt-2 font-semibold text-foreground">{contest.min_jlpt_level}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Điều kiện tham gia</CardTitle>
            <CardDescription>Contest này chỉ hỗ trợ chế độ phòng thi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-orange-500" />
                Người tham gia
              </div>
              <p className="mt-2 font-semibold text-foreground">
                {contest.participant_count}
                {contest.max_participants ? ` / ${contest.max_participants}` : ''} người
              </p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4 text-sm leading-7 text-muted-foreground">
              Nhấn tham gia để vào phòng thi, xem đề thi đã được người tạo chọn và bắt đầu làm bài
              như một contest đồng bộ. Nếu contest đã hết hạn thì chỉ xem thông tin, không thể làm
              bài hoặc tham gia thêm.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Bảng xếp hạng hiện tại</CardTitle>
          <CardDescription>
            Top 3 được làm nổi bật theo avatar và điểm số. Từ hạng 4 trở xuống hiển thị dạng danh sách.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {contest.leaderboard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              Chưa có người hoàn thành bài thi để xếp hạng.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {podium.map((entry, index) => (
                  <div
                    key={entry.user_id}
                    className={`rounded-3xl border p-5 text-center ${
                      index === 0
                        ? 'border-amber-300 bg-gradient-to-b from-amber-100 to-white'
                        : index === 1
                          ? 'border-slate-300 bg-gradient-to-b from-slate-100 to-white'
                          : 'border-orange-200 bg-gradient-to-b from-orange-100 to-white'
                    }`}
                  >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-card shadow-sm">
                      {entry.avatar_url ? (
                        <img
                          src={entry.avatar_url}
                          alt={entry.display_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-foreground">
                          {avatarFallback(entry.display_name)}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-foreground">
                      <Medal className="h-4 w-4" />
                      Top {entry.rank}
                    </div>
                    <p className="mt-4 text-lg font-bold text-foreground">{entry.display_name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">@{entry.username}</p>
                    <p className="mt-4 text-3xl font-black text-foreground">{entry.score.toFixed(2)}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Điểm</p>
                  </div>
                ))}
              </div>

              {rankingList.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border">
                  <div className="divide-y divide-border">
                    {rankingList.map((entry) => (
                      <div
                        key={entry.user_id}
                        className="flex items-center justify-between gap-4 bg-card px-5 py-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 text-sm font-bold text-muted-foreground">
                            #{entry.rank}
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-muted">
                            {entry.avatar_url ? (
                              <img
                                src={entry.avatar_url}
                                alt={entry.display_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-bold text-foreground">
                                {avatarFallback(entry.display_name)}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{entry.display_name}</p>
                            <p className="text-sm text-muted-foreground">@{entry.username}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">{entry.score.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">điểm</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
