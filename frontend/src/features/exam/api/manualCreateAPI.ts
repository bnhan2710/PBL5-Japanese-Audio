import { apiFetch } from '@/lib/apiClient';
import { ExamManualType, QuestionType } from '../types/manualExam';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function uploadFile(file: File, type: 'audio' | 'image'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const endpoint = type === 'audio' ? `${API_URL}/api/upload/audio` : `${API_URL}/api/upload/image`;
  
  const response = await apiFetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload ${type} file`);
  }

  const data = await response.json();
  return data.secure_url;
}

export async function submitManualExam(payload: ExamManualType): Promise<any> {
  // Deep clone to avoid mutating the React state
  const cleanedPayload: ExamManualType = JSON.parse(JSON.stringify(payload, (key, value) => {
      // JSON.parse stringify loses File objects, so we don't stringify first.
      // We do a manual deep clone that preserves File objects.
      return value;
  }));

  // Create a proper deep clone holding File references
  const finalPayload = { ...payload, questions: payload.questions.map(q => ({ ...q, answers: [...(q.answers || [])] })) };

  const uploadPromises: Promise<void>[] = [];

  finalPayload.questions.forEach((q: QuestionType) => {
    if (q.audio_clip_url instanceof File) {
      const p = uploadFile(q.audio_clip_url, 'audio').then(url => {
        q.audio_clip_url = url;
      });
      uploadPromises.push(p);
    }
    if (q.image_url instanceof File) {
        const p = uploadFile(q.image_url, 'image').then(url => {
          q.image_url = url;
        });
        uploadPromises.push(p);
    }
  });

  // Wait for all uploads to complete
  await Promise.all(uploadPromises);

  // Now all files are replaced with strings (Cloudinary URLs) or are null.
  // We can safely send the JSON to POST /api/exams/manual.
  
  const response = await apiFetch(`${API_URL}/api/exams/manual`, {
    method: 'POST',
    body: JSON.stringify(finalPayload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to submit exam');
  }

  return response.json();
}
