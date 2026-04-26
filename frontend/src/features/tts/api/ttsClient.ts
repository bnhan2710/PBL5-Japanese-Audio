import { apiFetch } from '@/lib/apiClient'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'TTS API Error')
  }
  return res.json()
}

export interface DialogueLine {
  speaker: string
  text: string
}

export interface SpeakerConfig {
  model_name: string
  style: string
  pitch_scale: number
  sdp_ratio: number
  reference_audio_url?: string
}

export interface TTSGenerateRequest {
  dialogues: DialogueLine[];
  speaker_configs: Record<string, SpeakerConfig>;
  title?: string;
  dialogue_pause?: number;
  narrator_pause?: number;
}

export interface TTSGenerateResponse {
  audio_id: string
  file_name: string
  file_url: string
}

export const ttsClient = {
  generateScript: (data: TTSGenerateRequest): Promise<TTSGenerateResponse> =>
    apiFetch(`${API_BASE}/api/tts/generate-script`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(handleResponse<TTSGenerateResponse>).then(res => {
      if (res.file_url && res.file_url.startsWith('/')) {
        res.file_url = `${API_BASE}${res.file_url}`
      }
      return res;
    }),
    
  uploadSample: (file: File): Promise<{ file_url: string }> => {
     const formData = new FormData()
     formData.append('file', file)
     return apiFetch(`${API_BASE}/api/tts/upload-sample`, {
       method: 'POST',
       body: formData,
     }).then(handleResponse<{ file_url: string }>).then(res => {
       if (res.file_url && res.file_url.startsWith('/')) {
         res.file_url = `${API_BASE}${res.file_url}`
       }
       return res;
     })
  },

  deleteSample: (filename: string): Promise<{ message: string }> => {
    return apiFetch(`${API_BASE}/api/tts/upload-sample/${filename}`, {
      method: 'DELETE',
    }).then(handleResponse<{ message: string }>)
  }
}
