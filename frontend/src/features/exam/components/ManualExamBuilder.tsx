import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/Card';
import { useAutoSaveDraft } from '../../../hooks/useAutoSaveDraft';
import { ExamManualType, ExamManualSchema, QuestionType } from '../types/manualExam';
import { QuestionEditor } from './QuestionEditor';
import { submitManualExam } from '../api/manualCreateAPI';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/toast'; // adjust if custom hook exists or use standard UI

const defaultExam: ExamManualType = {
  title: '',
  description: '',
  time_limit: 30, // Default 30 minutes
  is_published: false,
  questions: [],
};

const defaultAnswers = () => [
  { content: '', is_correct: true, order_index: 0 },
  { content: '', is_correct: false, order_index: 1 },
  { content: '', is_correct: false, order_index: 2 },
  { content: '', is_correct: false, order_index: 3 },
];

export const ManualExamBuilder: React.FC = () => {
  const [formData, setFormData, clearDraft] = useAutoSaveDraft<ExamManualType>('manual_exam_draft', defaultExam);
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  // Assume generic Toast or standard UI
  // const { toast } = useToast();

  const addQuestion = () => {
    if (formData.questions.length >= 70) {
      alert('Không được tạo quá 70 câu.');
      return;
    }
    const newQuestion: QuestionType = {
      mondai_group: 'Mondai 1',
      question_text: '',
      answers: defaultAnswers(),
    };
    setFormData((prev) => ({ ...prev, questions: [...prev.questions, newQuestion] }));
  };

  const updateQuestion = (idx: number, updated: QuestionType) => {
    setFormData((prev) => {
      const q = [...prev.questions];
      q[idx] = updated;
      return { ...prev, questions: q };
    });
  };

  const removeQuestion = (idx: number) => {
    setFormData((prev) => {
      const q = [...prev.questions];
      q.splice(idx, 1);
      return { ...prev, questions: q };
    });
  };

  const validateStep = () => {
    if (step === 1 && !formData.title.trim()) {
      alert("Tên đề thi là bắt buộc.");
      return false;
    }
    if (step === 2 && formData.questions.length === 0) {
      alert("Vui lòng tạo ít nhất 1 câu hỏi.");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep((s) => Math.min(3, s + 1));
  };

  const handlePrev = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    try {
       // Validate before submission
       ExamManualSchema.parse(formData);

       setIsSubmitting(true);
       await submitManualExam(formData);
       clearDraft();
       alert('Tạo đề thành công!');
       navigate('/admin/exams'); // or standard exams route
    } catch (err: any) {
      if (err.errors) {
        // Zod error
        alert('Validation Error: ' + err.errors[0]?.message);
      } else {
        alert('Đã có lỗi xảy ra: ' + (err.message || 'Lỗi server'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Wizard Header */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded shadow">
        <h2 className="text-xl font-bold">Tạo Đề Thủ Công</h2>
        <div className="flex gap-2">
           <span className={`px-3 py-1 rounded-full text-sm ${step === 1 ? 'bg-primary text-white' : 'bg-gray-200'}`}>1. Thông tin</span>
           <span className={`px-3 py-1 rounded-full text-sm ${step === 2 ? 'bg-primary text-white' : 'bg-gray-200'}`}>2. Nhập câu hỏi</span>
           <span className={`px-3 py-1 rounded-full text-sm ${step === 3 ? 'bg-primary text-white' : 'bg-gray-200'}`}>3. Review & Hoàn tất</span>
        </div>
      </div>

      {/* STEP 1: Details */}
      {step === 1 && (
         <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Thông tin đề thi</h3>
            <div>
               <label className="block text-sm font-medium mb-1">Tên đề thi *</label>
               <Input value={formData.title} onChange={e => setFormData(p => ({...p, title: e.target.value}))} placeholder="Nhập tên đề (Ví dụ: JLPT N3 Tháng 7/2026)" />
            </div>
            <div>
               <label className="block text-sm font-medium mb-1">Mô tả tổng quát</label>
               <textarea 
                  className="w-full border rounded-md p-2 dark:bg-gray-900 dark:border-gray-700" 
                  rows={3} 
                  value={formData.description || ''} 
                  onChange={e => setFormData(p => ({...p, description: e.target.value}))}
                  placeholder="Mô tả qua một chút (Tuỳ chọn)"
               />
            </div>
            <div className="flex gap-4">
                <div className="flex-1">
                   <label className="block text-sm font-medium mb-1">Thời gian làm bài (Phút)</label>
                   <Input type="number" value={formData.time_limit} onChange={e => setFormData(p => ({...p, time_limit: Number(e.target.value)}))} />
                </div>
                <div className="flex-1 flex flex-col justify-center pt-6">
                   <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.is_published} onChange={e => setFormData(p => ({...p, is_published: e.target.checked}))} className="w-5 h-5 rounded" />
                      <div>
                        <span className="font-semibold block">Công khai (Publish)</span>
                        <span className="text-xs text-gray-500">Đăng lên ngân hàng câu hỏi công cộng để trộn vào đề thi ngẫu nhiên.</span>
                      </div>
                   </label>
                </div>
            </div>
         </Card>
      )}

      {/* STEP 2: Questions List */}
      {step === 2 && (
         <div className="space-y-4">
             <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/30 p-4 rounded text-sm text-blue-700 dark:text-blue-300">
                <p>💡 Tip: Bạn có thể nhập bao nhiêu phần tuỳ ý bằng cách thay đổi "Tên Group". Thứ tự câu hỏi sẽ hiện từ trên xuống dưới. (Hiện tại: {formData.questions.length}/70 câu).</p>
                <Button onClick={addQuestion}>+ Thêm câu hỏi mới</Button>
             </div>
             
             {formData.questions.map((q, idx) => (
                <QuestionEditor
                  key={idx}
                  index={idx}
                  question={q}
                  onChange={(updated) => updateQuestion(idx, updated)}
                  onRemove={() => removeQuestion(idx)}
                />
             ))}

             {formData.questions.length === 0 && (
                <div className="text-center p-12 text-gray-400 bg-gray-50 dark:bg-gray-800 rounded border border-dashed">
                   Hiện chưa có câu hỏi nào. Bấm nút "Thêm câu hỏi mới" phía trên để bắt đầu.
                </div>
             )}
         </div>
      )}

      {/* STEP 3: PREVIEW */}
      {step === 3 && (
         <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Xác nhận Review Cuối (Xoá mù)</h3>
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded text-sm space-y-2 font-mono">
               <p><strong>Tiêu đề:</strong> {formData.title}</p>
               <p><strong>Số lượng câu:</strong> {formData.questions.length}</p>
               <p><strong>Công khai Question Bank:</strong> {formData.is_published ? 'Có' : 'Không'}</p>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto pr-4 space-y-2">
               {formData.questions.map((q, idx) => (
                  <div key={idx} className="border p-3 rounded text-sm relative">
                     <span className="font-bold text-gray-500 mr-2">[{q.mondai_group}]</span>
                     <span>{q.question_text || '(Không có Text gốc)'}</span>
                     {(q.audio_clip_url || q.image_url) && (
                        <div className="mt-1 text-xs text-blue-500">
                           {q.audio_clip_url && '🔊 Kèm Audio File - '}
                           {q.image_url && '🖼️ Kèm Hình ảnh'}
                        </div>
                     )}
                  </div>
               ))}
            </div>
            <div className="text-red-500 font-bold text-sm bg-red-100 p-3 rounded">
                Chú ý: Quá trình lưu sẽ tốn một ít thời gian để tải đẩy Media lên máy chủ. Hãy chờ đợi không được chuyển trang nhé!
            </div>
         </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center">
         <div>
            {step > 1 && <Button variant="outline" onClick={handlePrev}>Quay Lại</Button>}
         </div>
         <div>
            <Button variant="ghost" className="mr-4 text-red-500" onClick={clearDraft} disabled={isSubmitting}>Huỷ bản nháp</Button>
            {step < 3 && <Button onClick={handleNext}>Tiếp theo</Button>}
            {step === 3 && <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Đang tải lên...' : 'Lưu Đề thi & Upload'}</Button>}
         </div>
      </div>
    </div>
  );
};
