import { useEffect, useMemo, useState } from 'react'
import { Clock3, ExternalLink, FileAudio, Search, Sparkles } from 'lucide-react'

import { adminApi } from '../api/adminClient'
import type { AdminAudio, AdminAudioListResponse } from './types/audio'

const PAGE_SIZE = 8

function formatDuration(value?: number | null) {
  if (!value || value <= 0) return 'Chưa rõ'
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

function getStatusTone(status?: string | null) {
  switch (status) {
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'processing':
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'failed':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700'
  }
}

function normalizeTranscript(value?: string | null) {
  if (!value) return 'Chưa có transcript thô cho file nghe này.'
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= 220) return compact
  return `${compact.slice(0, 220)}...`
}

function AudioCard({ audio }: { audio: AdminAudio }) {
  return (
    <article className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
            <FileAudio className="h-4 w-4" />
            Audio Resource
          </div>
          <h2 className="mt-3 truncate text-xl font-bold text-foreground">
            {audio.file_name || 'Audio không có tên file'}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">ID: {audio.audio_id}</p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusTone(audio.ai_status)}`}
        >
          {audio.ai_status || 'pending'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Thời lượng
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock3 className="h-4 w-4 text-emerald-600" />
            {formatDuration(audio.duration)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Exam dùng lại
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">{audio.exam_count} đề</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Transcript segments
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">{audio.segment_count} đoạn</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-slate-950 px-4 py-4 text-slate-100">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            URL file nghe
          </p>
          <a
            href={audio.file_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 transition hover:text-emerald-200"
          >
            Mở file
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="mt-3 break-all font-mono text-xs leading-6 text-slate-100">
          {audio.file_url}
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-muted/20 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Transcript preview
        </p>
        <p className="mt-3 text-sm leading-6 text-foreground">
          {normalizeTranscript(audio.raw_transcript)}
        </p>
      </div>

      <div className="mt-5">
        <audio controls preload="none" src={audio.file_url} className="h-10 w-full outline-none" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-3 py-1 font-medium">
          AI model: {audio.ai_model || 'Chưa gán'}
        </span>
        <span className="rounded-full bg-muted px-3 py-1 font-medium">
          Hash: {audio.content_hash?.slice(0, 12) || 'N/A'}
        </span>
      </div>
    </article>
  )
}

export default function AudioLibraryPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AdminAudioListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAudios = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await adminApi.listAudios({
          q: search || undefined,
          ai_status: status || undefined,
          page,
          page_size: PAGE_SIZE,
        })
        setData(response)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách file nghe')
      } finally {
        setLoading(false)
      }
    }

    void fetchAudios()
  }, [page, search, status])

  const stats = useMemo(() => {
    const audios = data?.audios || []
    return {
      completed: audios.filter((audio) => audio.ai_status === 'completed').length,
      processing: audios.filter((audio) => audio.ai_status === 'processing').length,
    }
  }, [data])

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
            Admin Audio Library
          </p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Quản lý tài nguyên nghe</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Xem toàn bộ file nghe đã lưu trong hệ thống, nghe thử trực tiếp, kiểm tra trạng thái AI
            và theo dõi mức độ tái sử dụng của từng tài nguyên.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Tổng file đang hiển thị
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">{data?.total ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Completed / Processing
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              {stats.completed} / {stats.processing}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
              placeholder="Tìm theo tên file, URL hoặc transcript..."
              className="h-11 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm outline-none transition focus:border-emerald-400"
            />
          </label>

          <select
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value)
            }}
            className="h-11 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-emerald-400"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 rounded-[28px] border border-border bg-card px-6 py-10 text-sm text-muted-foreground shadow-sm">
          Đang tải thư viện file nghe...
        </div>
      ) : data?.audios?.length ? (
        <>
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {data.audios.map((audio) => (
              <AudioCard key={audio.audio_id} audio={audio} />
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Trang {data.page}/{data.total_pages} với {data.total} file nghe
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={data.page <= 1}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trang trước
              </button>
              <button
                onClick={() => setPage((current) => Math.min(data.total_pages, current + 1))}
                disabled={data.page >= data.total_pages}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trang sau
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-[28px] border border-border bg-card px-6 py-10 text-sm text-muted-foreground shadow-sm">
          Không tìm thấy file nghe nào khớp với bộ lọc hiện tại.
        </div>
      )}
    </div>
  )
}
