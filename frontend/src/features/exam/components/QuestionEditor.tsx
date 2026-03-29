import React, { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/input';
import { Trash, Upload, CheckCircle2, Circle } from 'lucide-react';
import { QuestionType } from '../types/manualExam';

interface QuestionEditorProps {
  question: QuestionType;
  index: number;
  onChange: (updated: QuestionType) => void;
  onRemove: () => void;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({ question, index, onChange, onRemove }) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const updateField = (field: keyof QuestionType, value: any) => {
    onChange({ ...question, [field]: value });
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      updateField('audio_clip_url', e.target.files[0]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      updateField('image_url', e.target.files[0]);
    }
  };

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

  const renderFileLabel = (fileOrUrl: any, placeholder: string) => {
    if (!fileOrUrl) return placeholder;
    if (fileOrUrl instanceof File) return fileOrUrl.name;
    // if URL existing
    if (typeof fileOrUrl === 'string' && fileOrUrl.length > 5) {
       return 'Đã có URL cũ';
    }
    return placeholder;
  };

  return (
    <Card className="pl-4 py-4 pr-6 mb-4 mt-2 border-l-4 border-l-primary relative">
      <div className="absolute top-4 right-4 text-gray-400 font-bold opacity-30 text-2xl">#{index + 1}</div>
      <div className="space-y-4 pr-12">
        {/* Row: Group and Question text */}
        <div className="flex gap-4">
          <div className="w-1/3">
            <label className="text-sm font-medium mb-1 block">Tên Group / Phần (Ví dụ: Mondai 1)</label>
            <Input
              value={question.mondai_group || ''}
              onChange={(e) => updateField('mondai_group', e.target.value)}
              placeholder="Ex: Mondai 1"
            />
          </div>
          <div className="w-2/3">
            <label className="text-sm font-medium mb-1 block">Nội dung câu hỏi (Tuỳ chọn)</label>
            <Input
              value={question.question_text || ''}
              onChange={(e) => updateField('question_text', e.target.value)}
              placeholder="e.g: 男の人はいつ会議に出発しますか。"
            />
          </div>
        </div>

        {/* Media Uploads */}
        <div className="flex gap-4">
          <div className="w-1/2">
             <label className="text-sm font-medium mb-1 block">File Audio mp3 (Bắt buộc cho JLPT)</label>
             <div className="flex items-center gap-2">
               <input type="file" accept="audio/*" className="hidden" ref={audioInputRef} onChange={handleAudioChange} />
               <Button type="button" variant="outline" className="w-full flex justify-start" onClick={() => audioInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  <span className="truncate">{renderFileLabel(question.audio_clip_url, 'Tải lên Audio')}</span>
               </Button>
               {question.audio_clip_url && (
                 <Button type="button" variant="ghost" size="icon" onClick={() => updateField('audio_clip_url', null)}><Trash className="w-4 h-4 text-red-500" /></Button>
               )}
             </div>
          </div>
          <div className="w-1/2">
            <label className="text-sm font-medium mb-1 block">Hình ảnh (Tuỳ chọn)</label>
             <div className="flex items-center gap-2">
               <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageChange} />
               <Button type="button" variant="outline" className="w-full flex justify-start" onClick={() => imageInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  <span className="truncate">{renderFileLabel(question.image_url, 'Tải lên Image')}</span>
               </Button>
                {question.image_url && (
                 <Button type="button" variant="ghost" size="icon" onClick={() => updateField('image_url', null)}><Trash className="w-4 h-4 text-red-500" /></Button>
               )}
             </div>
          </div>
        </div>

        {/* Answers */}
        <div className="bg-gray-50/50 dark:bg-gray-800/30 p-4 rounded-lg space-y-3">
           <label className="text-sm font-medium block">4 Đáp án (Click vào ✅ để chọn đáp án đúng)</label>
           {(question.answers || []).map((ans, i) => (
             <div key={i} className="flex items-center gap-3">
               <button
                  type="button"
                  onClick={() => setCorrectAnswer(i)}
                  className={`flex-shrink-0 transition-colors ${ans.is_correct ? 'text-green-500' : 'text-gray-300 hover:text-green-400'}`}
               >
                 {ans.is_correct ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
               </button>
               <div className="font-semibold text-gray-500 w-4 text-center">{['A', 'B', 'C', 'D'][i]}</div>
               <Input
                 value={ans.content || ''}
                 onChange={(e) => updateAnswer(i, e.target.value)}
                 placeholder={`Nhập đáp án ${['A', 'B', 'C', 'D'][i]}`}
                 className={ans.is_correct ? 'border-green-300 bg-green-50 dark:bg-green-900/10' : ''}
               />
             </div>
           ))}
        </div>

        {/* Explanation */}
        <div>
           <label className="text-sm font-medium mb-1 block">Giải thích (Tuỳ chọn)</label>
           <Input
              value={question.explanation || ''}
              onChange={(e) => updateField('explanation', e.target.value)}
              placeholder="Giải thích vì sao đáp án này đúng..."
           />
        </div>

        {/* Delete */}
        <div className="flex justify-end pt-2">
            <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={onRemove}>
                <Trash className="w-4 h-4 mr-2" /> Xoá câu hỏi này
            </Button>
        </div>
      </div>
    </Card>
  );
};
