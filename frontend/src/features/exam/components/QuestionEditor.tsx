import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Headphones, Trash2, Image as ImageIcon } from 'lucide-react';
import { QuestionType } from '../types/manualExam';
import { AIImageGenerateButton } from '../../ai-image/components/AIImageGenerateButton';

interface QuestionEditorProps {
  question: QuestionType;
  index: number;
  mondaiList: { id: number; label: string; nameJa: string }[];
  onChange: (updated: QuestionType) => void;
  onRemove: () => void;
  onNext: () => void;
  isLastQuestion: boolean;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({ 
  question, index, mondaiList, onChange, onRemove, onNext, isLastQuestion 
}) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [draggingAudio, setDraggingAudio] = useState(false);
  const [draggingImage, setDraggingImage] = useState(false);

  useEffect(() => {
    // Generate object URLs for File objects to preview them during edit
    if (question.audio_clip_url instanceof File) {
      const url = URL.createObjectURL(question.audio_clip_url);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof question.audio_clip_url === 'string') {
      setAudioUrl(question.audio_clip_url);
    } else {
      setAudioUrl(null);
    }
  }, [question.audio_clip_url]);

  useEffect(() => {
    if (question.image_url instanceof File) {
      const url = URL.createObjectURL(question.image_url);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof question.image_url === 'string') {
      setImageUrl(question.image_url);
    } else {
      setImageUrl(null);
    }
  }, [question.image_url]);

  const updateField = (field: keyof QuestionType, value: any) => {
    onChange({ ...question, [field]: value });
  };

  const handleAudioDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingAudio(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      updateField('audio_clip_url', file);
    }
  }, [onChange, question]);

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingImage(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      updateField('image_url', file);
    }
  }, [onChange, question]);

  const updateAnswer = (ansIndex: number, text: string) => {
    const newAnswers = [...(question.answers || [])];
    if (newAnswers[ansIndex]) {
      newAnswers[ansIndex] = { ...newAnswers[ansIndex], content: text };
      updateField('answers', newAnswers);
    }
  };

  const setCorrectAnswer = (ansIndex: number) => {
    const newAnswers = [...(question.answers || [])].map((ans, i) => ({
      ...ans,
      is_correct: i === ansIndex,
    }));
    updateField('answers', newAnswers);
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/50 shrink-0">
        <div className="flex items-center gap-3 w-full max-w-xl">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">Câu {index + 1}</h2>
          
          <select 
            value={question.mondai_group || 'Mondai 1'} 
            onChange={e => updateField('mondai_group', e.target.value)}
            className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-400"
          >
            {mondaiList.map(m => (
              <option key={m.id} value={`Mondai ${m.id}`}>
                {m.label} ({m.nameJa})
              </option>
            ))}
          </select>
        </div>
        
        <button onClick={onRemove} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-4">
          <Trash2 className="w-4 h-4" /> Xoá câu hỏi
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Audio Box */}
        <div 
          onDragOver={e => { e.preventDefault(); setDraggingAudio(true); }}
          onDragLeave={() => setDraggingAudio(false)}
          onDrop={handleAudioDrop}
          className={`border-2 rounded-xl p-5 transition-colors ${
            draggingAudio ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20' : 
            audioUrl ? 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-700' :
            'border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Headphones className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">File âm thanh (Bắt buộc cho JLPT nghe)</span>
          </div>
          
          {audioUrl ? (
            <div className="flex items-center justify-between gap-4">
              <audio controls src={audioUrl} className="w-full h-10 outline-none" />
              <button onClick={() => { updateField('audio_clip_url', null); }} className="text-xs text-red-500 hover:underline font-medium shrink-0 flex items-center gap-1">
                 Gỡ file
              </button>
            </div>
          ) : (
            <div className="text-center py-4 cursor-pointer" onClick={() => audioInputRef.current?.click()}>
               <p className="text-sm text-slate-500">
                  <span className="text-violet-500 font-semibold">Tải lên Audio</span> hoặc kéo thả file MP3/WAV vào đây
               </p>
            </div>
          )}
          <input type="file" accept="audio/*" className="hidden" ref={audioInputRef} onChange={e => e.target.files && handleAudioDrop({ preventDefault: () => {}, dataTransfer: { files: e.target.files } } as unknown as React.DragEvent)} />
        </div>

        {/* Script & Question Text */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Lời thoại Script (Tiếng Nhật)</label>
            <textarea
              value={question.explanation || ''} // Using explanation for script mapped in UI
              onChange={e => updateField('explanation', e.target.value)}
              rows={4}
              placeholder="Gõ nội dung script..."
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 font-medium leading-relaxed"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Nội dung câu hỏi (Tuỳ chọn)</label>
            <textarea
              value={question.question_text || ''}
              onChange={e => updateField('question_text', e.target.value)}
              rows={4}
              placeholder="e.g. 男の人はこれから何をしますか。"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 font-medium leading-relaxed"
            />
          </div>
        </div>

        {/* Choices */}
        <div className="pt-2">
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Đáp án lựa chọn (Chọn ✅ cho đáp án đúng)</label>
          <div className="grid grid-cols-1 gap-3">
            {(question.answers || []).map((a, ai) => (
              <div key={ai} className="flex items-center gap-4 group/answer">
                <button
                  type="button"
                  onClick={() => setCorrectAnswer(ai)}
                  className="flex flex-col items-center justify-center w-8 shrink-0 transition-opacity"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${a.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                    {a.is_correct && <span className="w-2.5 h-2.5 rounded-full bg-white" />}
                  </div>
                </button>
                <div className={`flex-1 border rounded-xl px-4 py-2.5 transition-colors ${a.is_correct ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${a.is_correct ? 'text-emerald-500' : 'text-slate-400'}`}>{['A', 'B', 'C', 'D'][ai]}.</span>
                    <input
                      value={a.content}
                      onChange={e => updateAnswer(ai, e.target.value)}
                      className="w-full text-sm bg-transparent border-0 outline-none text-slate-700 dark:text-slate-200 font-medium"
                      placeholder={`Nhập đáp án ${ai + 1}...`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Image Drop Box */}
        <div 
          onDragOver={e => { e.preventDefault(); setDraggingImage(true); }}
          onDragLeave={() => setDraggingImage(false)}
          onDrop={handleImageDrop}
          className={`border-2 rounded-xl p-5 mt-4 transition-colors ${
            draggingImage ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20' : 
            imageUrl ? 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-700' :
            'border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Hình ảnh đề bài (Tuỳ chọn)</span>
          </div>
          {imageUrl ? (
            <div className="flex flex-col items-start gap-4 mt-3">
              <img src={imageUrl} alt="preview" className="max-h-32 rounded-lg border border-slate-200 shadow-sm" />
              <button onClick={() => { updateField('image_url', null); }} className="text-xs text-red-500 hover:underline font-medium">
                 Gỡ hình ảnh
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="text-center cursor-pointer" onClick={() => imageInputRef.current?.click()}>
                 <p className="text-sm text-slate-500">
                    <span className="text-violet-500 font-semibold">Tải lên Ảnh</span> hoặc kéo thả file
                 </p>
              </div>
              <div className="w-full relative flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700"></div></div>
                <span className="relative bg-slate-50 dark:bg-slate-900/30 px-3 text-xs text-slate-400 font-medium">HOẶC</span>
              </div>
              <AIImageGenerateButton 
                payload={{
                  question_id: `manual_q_${index}`,
                  script_text: question.explanation || '',
                  question_text: question.question_text || '',
                  jlpt_level: 'N2',
                }}
                onSuccess={(url) => updateField('image_url', url)}
                buttonText="Sinh ảnh từ Script bằng AI"
              />
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={e => e.target.files && handleImageDrop({ preventDefault: () => {}, dataTransfer: { files: e.target.files } } as unknown as React.DragEvent)} />
        </div>
      </div>

      {/* Footer next button */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20 shrink-0 flex justify-end">
        <button 
          onClick={onNext}
          className="px-6 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-violet-600 hover:to-purple-700 shadow-md shadow-violet-500/20 transition-all"
        >
          {isLastQuestion ? 'Ghi nhận & Tạo câu tiếp theo' : 'Ghi nhận & Lưu'}
        </button>
      </div>
    </div>
  );
};
