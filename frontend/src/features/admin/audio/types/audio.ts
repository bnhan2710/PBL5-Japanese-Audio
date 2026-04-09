export interface AdminAudio {
  audio_id: string
  file_name?: string | null
  file_url: string
  duration?: number | null
  ai_status?: string | null
  ai_model?: string | null
  raw_transcript?: string | null
  content_hash?: string | null
  exam_count: number
  segment_count: number
}

export interface AdminAudioListResponse {
  audios: AdminAudio[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
