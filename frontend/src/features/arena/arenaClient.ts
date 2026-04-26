import { apiFetch } from '@/lib/apiClient'
import type { TestExamDetail, TestSubmitPayload, TestSubmitResult } from '@/features/test/types'

export type ArenaStatus = 'upcoming' | 'ongoing' | 'expired'
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface ArenaContest {
  contest_id: string
  title: string
  description?: string | null
  min_jlpt_level: JLPTLevel
  max_participants?: number | null
  time_limit: number
  start_time: string
  end_time: string
  creator_id?: number | null
  exam_id: string
  exam_title: string
  participant_count: number
  joined: boolean
  joined_at?: string | null
  result_id?: string | null
  leaderboard: ArenaLeaderboardEntry[]
  created_at: string
  updated_at: string
}

export interface ArenaLeaderboardEntry {
  user_id: number
  username: string
  display_name: string
  avatar_url?: string | null
  score: number
  rank: number
  joined_at: string
}

export interface ArenaContestCreatePayload {
  title: string
  description?: string
  min_jlpt_level: JLPTLevel
  max_participants?: number
  time_limit: number
  start_time: string
  end_time: string
  exam_id: string
}

export interface ArenaContestUpdatePayload {
  title?: string
  description?: string
  min_jlpt_level?: JLPTLevel
  max_participants?: number | null
  time_limit?: number
  start_time?: string
  end_time?: string
  exam_id?: string
}

interface ArenaContestListResponse {
  contests: ArenaContest[]
}

interface ArenaJoinResponse {
  contest: ArenaContest
  message: string
}

interface ArenaTakeResponse {
  contest: ArenaContest
  exam: TestExamDetail
}

interface ArenaSubmitResponse {
  contest: ArenaContest
  submission: TestSubmitResult
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || 'API request failed')
  }
  return response.json()
}

export function getArenaStatus(
  contest: Pick<ArenaContest, 'start_time' | 'end_time'>
): ArenaStatus {
  const now = new Date()
  const start = new Date(contest.start_time)
  const end = new Date(contest.end_time)

  if (now < start) return 'upcoming'
  if (now > end) return 'expired'
  return 'ongoing'
}

export const arenaClient = {
  listContests: () =>
    apiFetch(`${API_BASE}/api/arena/contests`)
      .then((response) => handleResponse<ArenaContestListResponse>(response))
      .then((data) => data.contests),

  getContest: (contestId: string) =>
    apiFetch(`${API_BASE}/api/arena/contests/${contestId}`).then((response) =>
      handleResponse<ArenaContest>(response)
    ),

  createContest: (payload: ArenaContestCreatePayload) =>
    apiFetch(`${API_BASE}/api/arena/contests`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => handleResponse<ArenaContest>(response)),

  updateContest: (contestId: string, payload: ArenaContestUpdatePayload) =>
    apiFetch(`${API_BASE}/api/arena/contests/${contestId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((response) => handleResponse<ArenaContest>(response)),

  joinContest: (contestId: string) =>
    apiFetch(`${API_BASE}/api/arena/contests/${contestId}/join`, {
      method: 'POST',
    })
      .then((response) => handleResponse<ArenaJoinResponse>(response))
      .then((data) => data.contest),

  getContestTakeData: (contestId: string) =>
    apiFetch(`${API_BASE}/api/arena/contests/${contestId}/take`).then((response) =>
      handleResponse<ArenaTakeResponse>(response)
    ),

  submitContest: (contestId: string, payload: TestSubmitPayload) =>
    apiFetch(`${API_BASE}/api/arena/contests/${contestId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => handleResponse<ArenaSubmitResponse>(response)),

  getStatusLabel(status: ArenaStatus) {
    if (status === 'ongoing') return 'Đang diễn ra'
    if (status === 'expired') return 'Hết hạn'
    return 'Sắp diễn ra'
  },

  getStatusClasses(status: ArenaStatus) {
    if (status === 'ongoing') {
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    }
    if (status === 'expired') {
      return 'bg-slate-200 text-slate-700 border border-slate-300'
    }
    return 'bg-amber-100 text-amber-700 border border-amber-200'
  },
}
