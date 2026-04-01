import { useState, useCallback, useEffect, useRef } from 'react';
import { aiImageClient, AIImageJobStatus, AIImageTaskRequest } from '../api/aiImageClient';
import { toast } from '@/hooks/use-toast';

export function useAIImageGenerate(onSuccess?: (imageUrl: string) => void) {
  const [job, setJob] = useState<AIImageJobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((jobId: string) => {
    clearTimer();
    const poll = async () => {
      try {
        const status = await aiImageClient.getJobStatus(jobId);
        setJob(status);

        if (status.status === 'done' && status.result) {
          clearTimer();
          setLoading(false);
          toast({ title: 'Thành công', description: 'Đã sinh ảnh AI thành công!' });
          if (onSuccess) onSuccess(status.result.image_url);
        } else if (status.status === 'failed') {
          clearTimer();
          setLoading(false);
          toast({ title: 'Sinh ảnh thất bại', description: status.error || 'Pipeline thất bại', variant: 'destructive' });
        }
      } catch (err: any) {
        // Ignored for polling
      }
    };

    poll(); // immediate first hit
    pollIntervalRef.current = setInterval(poll, 3000);
  }, [clearTimer, onSuccess]);

  const generate = useCallback(async (payload: AIImageTaskRequest) => {
    try {
      if (!payload.script_text) {
         toast({ title: 'Lỗi', description: 'Cần có script tiếng Nhật để AI vẽ ảnh hợp ngữ cảnh.', variant: 'destructive' });
         return;
      }
      setLoading(true);
      setJob({ job_id: 'init', status: 'pending', progress_message: 'Khởi tạo tác vụ vẽ ảnh AI...' });
      
      const res = await aiImageClient.generateImage(payload);
      startPolling(res.job_id);

    } catch (error: any) {
      setLoading(false);
      setJob(null);
      toast({ title: 'Lỗi gọi API', description: error.message || 'Lỗi không xác định', variant: 'destructive' });
    }
  }, [startPolling]);

  // Clean up on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return {
    generate,
    loading,
    job,
    progressMessage: job?.progress_message || ''
  };
}
