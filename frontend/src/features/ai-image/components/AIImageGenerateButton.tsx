import React from 'react';
import { Loader2, Wand2, Sparkles } from 'lucide-react';
import { useAIImageGenerate } from '../hooks/useAIImageGenerate';
import { AIImageTaskRequest } from '../api/aiImageClient';

interface AIImageGenerateButtonProps {
  payload: Partial<AIImageTaskRequest>;
  onSuccess: (imageUrl: string) => void;
  className?: string;
  buttonText?: string;
}

export const AIImageGenerateButton: React.FC<AIImageGenerateButtonProps> = ({ 
  payload, onSuccess, className = '', buttonText = 'Sinh ảnh AI (JLPT)' 
}) => {
  const { generate, loading, progressMessage } = useAIImageGenerate((url) => {
    onSuccess(url);
  });

  const handleGenerate = () => {
    if (!payload.script_text) {
      alert('Vui lòng nhập lời thoại script tiếng Nhật trước khi sinh ảnh để AI phân tích ngữ cảnh!');
      return;
    }
    
    // Gán dữ liệu mặc định nếu component cha truyền thiếu
    const fullPayload: AIImageTaskRequest = {
       question_id: payload.question_id || 'manual_' + Date.now(),
       script_text: payload.script_text || '',
       question_text: payload.question_text || '',
       jlpt_level: payload.jlpt_level || 'N3',
       mode: payload.mode || 'quad'
    };

    generate(fullPayload);
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-violet-600 hover:to-purple-700 disabled:opacity-60 transition-all shadow-md shadow-violet-500/20"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {loading ? 'Đang Vẽ Ảnh...' : buttonText}
      </button>
      
      {loading && progressMessage && (
         <div className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 mt-1 pb-2 bg-violet-50 dark:bg-violet-900/30 px-3 py-1.5 rounded-lg w-full justify-center border border-violet-100 dark:border-violet-800">
            <Sparkles className="w-3 h-3 animate-pulse" /> 
            <span className="truncate max-w-[200px]" title={progressMessage}>{progressMessage}</span>
         </div>
      )}
    </div>
  );
};
