import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  CalendarRange,
  ChevronDown,
  Clock3,
  Search,
  Swords,
  Tag,
  Trophy,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/input'
import { arenaClient, getArenaStatus, type ArenaContest, type ArenaStatus } from './arenaClient'

const levelOptions = ['all', 'N5', 'N4', 'N3', 'N2', 'N1'] as const
const statusOptions = ['all', 'upcoming', 'ongoing', 'expired'] as const

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ArenaCard({ contest, onUpdate }: { contest: ArenaContest; onUpdate: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const status = getArenaStatus(contest)
  const isOwner = user?.id === contest.creator_id || user?.role === 'admin'

  return (
    <Card className="group overflow-hidden border-border/80 bg-card/90 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <CardContent className="p-0">
        <div className="relative border-b border-border/60 bg-gradient-to-r from-orange-100 via-amber-50 to-white p-5 dark:from-orange-950/40 dark:via-amber-950/20 dark:to-card">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
                JLPT Ranking Arena
              </p>
              <h3 className="line-clamp-1 text-lg font-semibold leading-tight text-foreground">
                {contest.title}
              </h3>
            </div>
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{contest.description}</p>

          <div className="absolute right-3 top-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur-md ${arenaClient.getStatusClasses(
                status
              )}`}
            >
              {arenaClient.getStatusLabel(status)}
            </span>
          </div>

          {isOwner && (
            <div className="absolute left-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100"></div>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-orange-500" />
              <span>{formatDateTime(contest.start_time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-orange-500" />
              <span>{contest.time_limit} phút làm bài</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-orange-500" />
              <span>Tối thiểu {contest.min_jlpt_level}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-500" />
              <span>
                {contest.participant_count}
                {contest.max_participants ? ` / ${contest.max_participants}` : ''} người tham gia
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">{contest.exam_title}</p>
            <p className="mt-1 text-muted-foreground">Chế độ thi: Phòng thi</p>
          </div>

          <Link to={`/arena/${contest.contest_id}`}>
            <Button className="w-full bg-orange-600 hover:bg-orange-700">
              Xem chi tiết cuộc thi
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ArenaPage() {
  const navigate = useNavigate()
  const [contests, setContests] = useState<ArenaContest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<(typeof levelOptions)[number]>('all')
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchContests = useCallback(() => {
    setLoading(true)
    arenaClient
      .listContests()
      .then(setContests)
      .catch((err: Error) => setError(err.message || 'Không thể tải danh sách cuộc thi'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchContests()
  }, [fetchContests])

  const filteredContests = useMemo(() => {
    return contests.filter((contest) => {
      const status = getArenaStatus(contest)
      const matchSearch =
        !searchQuery ||
        contest.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contest.description || '').toLowerCase().includes(searchQuery.toLowerCase())

      const matchLevel = levelFilter === 'all' || contest.min_jlpt_level === levelFilter
      const matchStatus = statusFilter === 'all' || status === statusFilter

      return matchSearch && matchLevel && matchStatus
    })
  }, [contests, levelFilter, searchQuery, statusFilter])

  const statusSummary = useMemo(() => {
    return contests.reduce<Record<ArenaStatus, number>>(
      (acc, contest) => {
        acc[getArenaStatus(contest)] += 1
        return acc
      },
      { upcoming: 0, ongoing: 0, expired: 0 }
    )
  }, [contests])

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-2">
      <section className="overflow-hidden rounded-[28px] border border-orange-200/70 bg-gradient-to-br from-orange-100 via-amber-50 to-white dark:border-orange-900/40 dark:from-orange-950/30 dark:via-amber-950/10 dark:to-background">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.5fr_1fr] lg:p-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-300 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
              <Swords className="h-4 w-4" />
              JLPT Ranking Arena
            </div>
            <h1 className="max-w-2xl text-3xl font-bold leading-tight text-foreground lg:text-4xl">
              Tạo phòng thi và để người học tranh hạng trên chính bộ đề bạn đã tạo.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground lg:text-base">
              Arena cho phép mở contest theo khung giờ cụ thể, chọn một đề trong kho đề của tôi,
              giới hạn người tham gia và chỉ vận hành ở chế độ phòng thi.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                className="bg-orange-600 px-5 hover:bg-orange-700"
                onClick={() => navigate('/arena/create')}
              >
                Tạo cuộc thi
              </Button>
              <Link to="/exam">
                <Button variant="outline" className="px-5">
                  Xem đề thi của tôi
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-card/60">
              <p className="text-sm text-muted-foreground">Đang diễn ra</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{statusSummary.ongoing}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-card/60">
              <p className="text-sm text-muted-foreground">Sắp diễn ra</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{statusSummary.upcoming}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-card/60">
              <p className="text-sm text-muted-foreground">Hết hạn</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{statusSummary.expired}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm theo tên hoặc mô tả cuộc thi"
              className="pl-9"
            />
          </div>

          <div className="relative">
            <Trophy className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={levelFilter}
              onChange={(event) =>
                setLevelFilter(event.target.value as (typeof levelOptions)[number])
              }
              className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Mọi trình độ</option>
              <option value="N5">N5</option>
              <option value="N4">N4</option>
              <option value="N3">N3</option>
              <option value="N2">N2</option>
              <option value="N1">N1</option>
            </select>
          </div>

          <div className="relative">
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as (typeof statusOptions)[number])
              }
              className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Mọi trạng thái</option>
              <option value="ongoing">Đang diễn ra</option>
              <option value="upcoming">Sắp diễn ra</option>
              <option value="expired">Hết hạn</option>
            </select>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      ) : filteredContests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-lg font-semibold text-foreground">Không có cuộc thi phù hợp</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Thử đổi bộ lọc hoặc tạo một arena mới từ đề thi của bạn.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredContests.map((contest) => (
            <ArenaCard key={contest.contest_id} contest={contest} onUpdate={fetchContests} />
          ))}
        </div>
      )}
    </div>
  )
}
