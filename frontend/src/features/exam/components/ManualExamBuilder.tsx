import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAutoSaveDraft } from '../../../hooks/useAutoSaveDraft';
import { ExamManualType, ExamManualSchema, QuestionType } from '../types/manualExam';
import { QuestionEditor } from './QuestionEditor';
import { submitManualExam } from '../api/manualCreateAPI';
import { useNavigate } from 'react-router-dom';
import { 
  Check, Play, Pause, Headphones, Loader2, Sparkles, Wand2, 
  Settings, PenTool, CheckCircle2, ChevronLeft, Save, Eye, Layers 
} from 'lucide-react';

type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

const LEVEL_COLORS: Record<Level, string> = {
  N5: 'from-emerald-400 to-teal-500',
  N4: 'from-sky-400 to-blue-500',
  N3: 'from-violet-400 to-purple-500',
  N2: 'from-orange-400 to-amber-500',
  N1: 'from-rose-400 to-red-500',
};

const DEFAULT_MONDAI = [
  { id: 1, label: 'Mondai 1: Task-based Comprehension', nameJa: 'Kadairikai' },
  { id: 2, label: 'Mondai 2: Point Comprehension', nameJa: 'Pointorikai' },
  { id: 3, label: 'Mondai 3: Summary Comprehension', nameJa: 'Gaiyourikai' },
  { id: 4, label: 'Mondai 4: Quick Response', nameJa: 'Sokujioutou' },
  { id: 5, label: 'Mondai 5: Integrated Comprehension', nameJa: 'Sougourikai' },
];

const defaultAnswers = () => [
  { content: '', is_correct: true, order_index: 0 },
  { content: '', is_correct: false, order_index: 1 },
  { content: '', is_correct: false, order_index: 2 },
  { content: '', is_correct: false, order_index: 3 },
];

const NEW_QUESTION_TEMPLATE: QuestionType = {
  mondai_group: 'Mondai 1',
  question_text: '',
  explanation: '',
  answers: defaultAnswers(),
};

const defaultExam: ExamManualType = {
  title: '',
  description: '',
  time_limit: 30, 
  is_published: false,
  level: 'N3',
  questions: [NEW_QUESTION_TEMPLATE], // Start with 1 blank
};

type WizardStep = 1 | 2 | 3;
const STEP_LABELS = ['Cấu hình Đề thi', 'Biên tập & Nhập liệu', 'Review & Xuất bản'];

function StepIndicator({ step }: { step: WizardStep }) {
  return (
    <div className="flex items-center justify-center mb-10 mt-4">
      {STEP_LABELS.map((label, i) => {
        const idx = (i + 1) as WizardStep;
        const done = step > idx;
        const active = step === idx;
        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300
                ${done
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : active
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 border-transparent text-white shadow-lg shadow-violet-500/40'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                }`}>
                {done ? <Check className="w-4 h-4" /> : active && idx === 2 ? <PenTool className="w-4 h-4" /> : active && idx === 3 ? <Eye className="w-4 h-4" /> : idx}
              </div>
              <span className={`mt-1.5 text-xs whitespace-nowrap font-medium transition-colors
                ${active ? 'text-violet-600 dark:text-violet-400' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`w-20 h-0.5 mx-2 -mt-5 transition-all duration-500
                ${step > idx ? 'bg-emerald-400' : step === idx ? 'bg-gradient-to-r from-violet-400 to-slate-200 dark:to-slate-700' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// MediaPreview helper to avoid inline createObjectURL issues
function MediaPreview({ fileOrUrl, type }: { fileOrUrl: File | string | null | undefined, type: 'audio' | 'image' }) {
  const [src, setSrc] = useState<string | null>(null);

  React.useEffect(() => {
    if (!fileOrUrl) {
      setSrc(null);
      return;
    }
    if (fileOrUrl instanceof File) {
      const url = URL.createObjectURL(fileOrUrl);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    setSrc(fileOrUrl);
  }, [fileOrUrl]);

  if (!src) return null;

  if (type === 'audio') {
    return <audio controls src={src} className="w-full h-10 outline-none" />;
  }
  return <img src={src} alt="Preview" className="max-h-48 rounded-lg border border-slate-200 mt-2 object-contain" />;
}

export const ManualExamBuilder: React.FC = () => {
  const [formData, setFormData, clearDraft] = useAutoSaveDraft<ExamManualType>('manual_exam_draft', defaultExam);
  const [step, setStep] = useState<WizardStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeQIdx, setActiveQIdx] = useState<number>(0);
  const navigate = useNavigate();

  const handleNextStep1 = () => {
    if (!formData.title.trim()) {
      alert("Tên đề thi là bắt buộc.");
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = () => {
    if (formData.questions.length === 0) {
      alert("Vui lòng tạo ít nhất 1 câu hỏi.");
      return;
    }
    setStep(3);
  };

  const addQuestionAndSlide = () => {
    if (formData.questions.length >= 70) {
      alert('Không được tạo quá 70 câu.');
      return;
    }
    setFormData((prev) => {
      const currentMondaiGroup = prev.questions[activeQIdx]?.mondai_group || 'Mondai 1';
      return { 
        ...prev, 
        questions: [...prev.questions, { ...NEW_QUESTION_TEMPLATE, mondai_group: currentMondaiGroup }] 
      };
    });
    setActiveQIdx(formData.questions.length); // slides to new
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
    setActiveQIdx(Math.max(0, idx - 1));
  };

  const handleSubmit = async () => {
    try {
       ExamManualSchema.parse(formData);
       setIsSubmitting(true);
       await submitManualExam(formData);
       clearDraft();
       alert('Tạo đề thành công!');
       navigate('/exam');
    } catch (err: any) {
      if (err.errors) {
        alert('Validation Error: ' + err.errors[0]?.message);
      } else {
        alert('Đã có lỗi xảy ra: ' + (err.message || 'Lỗi server'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grouped questions for Step 2 and Step 3 Sidebar
  const groupedQuestions = formData.questions.reduce((acc, q, idx) => {
    const group = q.mondai_group || 'Mondai 1';
    if (!acc[group]) acc[group] = [];
    acc[group].push({ q, idx });
    return acc;
  }, {} as Record<string, { q: QuestionType, idx: number }[]>);

  const sortedGroupEntries = Object.entries(groupedQuestions).sort(([a], [b]) => a.localeCompare(b));

  const activeQ = formData.questions[activeQIdx];
  const isLastQuestion = activeQIdx === formData.questions.length - 1;

  const handleCancelCreation = () => {
    if (window.confirm('Bạn có chắc chắn muốn huỷ tạo đề thi? Toàn bộ dữ liệu bạn đã soạn sẽ bị xoá sạch.')) {
      clearDraft();
      navigate('/exam'); // return to exam list or home
    }
  };

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {/* STEP 1: Details */}
      {step === 1 && (
         <div className="space-y-6 max-w-3xl mx-auto">
            <h3 className="block text-xl font-bold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-violet-500" /> Cấu hình cơ bản
            </h3>
            <div className="space-y-5">
               <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Tên đề thi *</label>
                  <input 
                    value={formData.title} 
                    onChange={e => setFormData(p => ({...p, title: e.target.value}))} 
                    placeholder="Ví dụ: JLPT N3 Tháng 7/2026" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent" 
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Mô tả tổng quát (Tuỳ chọn)</label>
                  <textarea 
                     className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400" 
                     rows={3} 
                     value={formData.description || ''} 
                     onChange={e => setFormData(p => ({...p, description: e.target.value}))}
                     placeholder="Đề này tập trung vào ôn tập chủ điểm gì?..."
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Thời gian làm bài (Phút) *</label>
                      <input 
                         type="number" 
                         value={formData.time_limit} 
                         onChange={e => setFormData(p => ({...p, time_limit: Number(e.target.value)}))} 
                         className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400" 
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Cấp độ JLPT</label>
                      <div className="flex gap-2">
                        {LEVELS.map(l => (
                          <button key={l} onClick={() => setFormData(p => ({...p, level: l}))}
                            className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all duration-200
                              ${formData.level === l
                                ? `bg-gradient-to-br ${LEVEL_COLORS[l]} border-transparent text-white shadow-lg`
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}>
                            {l}
                          </button>
                        ))}
                      </div>
                   </div>
                   <div className="flex flex-col justify-center pt-8 col-span-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={formData.is_published} 
                           onChange={e => setFormData(p => ({...p, is_published: e.target.checked}))} 
                           className="w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-600" 
                         />
                         <div>
                           <span className="font-bold block text-sm text-slate-700 dark:text-slate-200">Public Question Bank</span>
                           <span className="text-xs text-slate-500">Cho phép hệ thống trộn ngẫu nhiên câu hỏi trong đề này vào các bài Quiz sau này.</span>
                         </div>
                      </label>
                   </div>
               </div>
            </div>

            <div className="flex justify-end pt-4 mt-8 border-t border-slate-200 dark:border-slate-700">
               <button 
                  onClick={handleCancelCreation} 
                  disabled={isSubmitting}
                  className="mr-4 px-6 py-3 border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 rounded-xl text-sm font-bold transition-all"
               >
                  Huỷ tạo đề
               </button>
               <button onClick={handleNextStep1} className="px-7 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-violet-600 hover:to-purple-700 shadow-md">
                   Tiếp theo
               </button>
            </div>
         </div>
      )}

      {/* STEP 2: Edit Layout - Two Columns */}
      {step === 2 && (
         <div className="flex flex-col md:flex-row gap-6 mt-4 md:h-[700px]">
            {/* Left Sidebar */}
            <div className="w-full md:w-[300px] shrink-0 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800/20 overflow-hidden flex flex-col shadow-sm">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/80">
                   <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">TỔNG HỢP ({formData.questions.length}/70)</h3>
                   <button onClick={addQuestionAndSlide} className="text-[10px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 px-2.5 py-1 rounded-full hover:bg-violet-200 transition-colors">
                     + Thêm Câu
                   </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                   {Object.entries(groupedQuestions).length === 0 && (
                      <p className="text-sm text-slate-400 text-center">Chưa có câu hỏi nào.</p>
                   )}
                   {sortedGroupEntries.map(([group, qs]) => (
                     <div key={group}>
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{group}</h4>
                         <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{qs.length} câu</span>
                       </div>
                       <div className="flex flex-wrap gap-2.5">
                         {qs.map(({ idx }, localIdx) => {
                           const isActive = activeQIdx === idx;
                           return (
                             <button
                               key={idx}
                               onClick={() => setActiveQIdx(idx)}
                               className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200
                                 ${isActive
                                   ? 'border-violet-500 bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400 shadow-sm'
                                   : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:bg-slate-800'
                                 }`}
                             >
                               {localIdx + 1}
                             </button>
                           )
                         })}
                       </div>
                     </div>
                   ))}
                </div>

                {/* Next Step Nav inside Sidebar Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
                   <div className="flex items-center gap-2 w-full">
                     <button onClick={() => setStep(1)} className="flex items-center gap-2 p-3 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                     </button>
                     <button onClick={handleNextStep2} className="flex-1 px-4 py-3 bg-slate-800 dark:bg-slate-600 text-white rounded-xl text-sm font-bold shadow-sm text-center transform hover:scale-[1.02] transition-all">
                        Tiếp tục review →
                     </button>
                   </div>
                   <button 
                     onClick={handleCancelCreation}
                     className="w-full px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 rounded-xl text-sm font-bold transition-all"
                   >
                     Huỷ bỏ tạo đề
                   </button>
                </div>
            </div>

            {/* Right Editor */}
            {activeQ ? (
                <QuestionEditor 
                  question={activeQ}
                  index={activeQIdx}
                  localIndex={groupedQuestions[activeQ.mondai_group || 'Mondai 1']?.findIndex(q => q.idx === activeQIdx) || 0}
                  mondaiList={DEFAULT_MONDAI}
                  onChange={(q) => updateQuestion(activeQIdx, q)}
                  onRemove={() => removeQuestion(activeQIdx)}
                  isLastQuestion={isLastQuestion}
                  onNext={() => {
                     if (isLastQuestion) addQuestionAndSlide();
                     else setActiveQIdx(activeQIdx + 1);
                  }}
                  level={formData.level || 'N3'}
                />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <PenTool className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="text-slate-500 font-medium">Bấm "Thêm nút ở danh sách bên trái" để biên tập</p>
                </div>
            )}
         </div>
      )}

      {/* STEP 3: PREVIEW (Identical layout to AI Step 3) */}
      {step === 3 && (
         <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{formData.title}</h3>
                    <div className="flex gap-6 mt-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{formData.questions.length}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Câu hỏi</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{Object.keys(groupedQuestions).length}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Mondai</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formData.time_limit}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Phút</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button 
                      onClick={handleCancelCreation}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 rounded-xl transition-all font-semibold"
                    >
                      Huỷ tạo đề
                    </button>
                    <button onClick={() => setStep(2)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Về Màn Chỉnh Sửa
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60 transition-all shadow-lg shadow-emerald-500/30">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isSubmitting ? 'Đang Upload (Vui lòng chờ)' : 'Hoàn Tất Upload'}
                    </button>
                  </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mt-4 md:h-[600px]">
               {/* Left Sidebar List */}
               <div className="w-full md:w-[300px] shrink-0 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800/20 overflow-hidden flex flex-col shadow-sm">
                 <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {sortedGroupEntries.map(([group, qs]) => (
                      <div key={group}>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{group}</h4>
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{qs.length} câu</span>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          {qs.map(({ idx }, localIdx) => {
                            const isActive = activeQIdx === idx;
                            const hasAns = formData.questions[idx].answers.some(a => a.is_correct && (a.content || '').trim() !== '');
                            return (
                              <button
                                key={idx}
                                onClick={() => setActiveQIdx(idx)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200
                                  ${isActive
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 shadow-sm'
                                    : hasAns
                                      ? 'border-emerald-500 text-emerald-600 bg-white dark:bg-slate-800 hover:bg-emerald-50'
                                      : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:bg-slate-800'
                                  }`}
                              >
                                {localIdx + 1}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                 </div>
               </div>

               {/* Right detail read-only mode */}
               {activeQ && (
                 <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/50">
                      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Câu {(groupedQuestions[activeQ.mondai_group || 'Mondai 1']?.findIndex(q => q.idx === activeQIdx) || 0) + 1} Preview</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 pointer-events-none opacity-80">
                         {/* Notice read-only */}
                         <div className="text-center font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded text-sm w-fit border border-emerald-200">
                             Chế độ xem tĩnh (Read-only)
                         </div>
                         
                         {/* Audio */}
                         {activeQ.audio_clip_url && (
                            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-5 pointer-events-auto">
                              <div className="flex items-center gap-2 mb-3">
                                <Headphones className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Audio Preview</span>
                              </div>
                              <MediaPreview fileOrUrl={activeQ.audio_clip_url} type="audio" />
                            </div>
                         )}

                         {/* Image */}
                         {activeQ.image_url && (
                            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-5 pointer-events-auto">
                              <div className="flex items-center gap-2 mb-2">
                                <Eye className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Image Preview</span>
                              </div>
                              <MediaPreview fileOrUrl={activeQ.image_url} type="image" />
                            </div>
                         )}
                         
                         {/* Texts */}
                         <div>
                            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Script</label>
                            <div className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-900/60 font-medium">
                               {activeQ.explanation || 'Trống'}
                            </div>
                         </div>
                         <div>
                            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Nội dung câu hỏi</label>
                            <div className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-900/60 font-medium">
                               {activeQ.question_text || '(Không có Text gốc)'}
                            </div>
                         </div>
                         
                         {/* Answers */}
                         <div className="space-y-3">
                           {activeQ.answers.map((a, ai) => (
                             <div key={ai} className="flex items-center gap-4">
                               <div className="flex flex-col items-center justify-center w-8">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${a.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                      {a.is_correct && <span className="w-2.5 h-2.5 rounded-full bg-white" />}
                                  </div>
                               </div>
                               <div className={`flex-1 border rounded-xl px-4 py-2.5 ${a.is_correct ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                                 <span className={`text-sm font-bold ${a.is_correct ? 'text-emerald-500' : 'text-slate-400'} mr-2`}>{['A','B','C','D'][ai]}.</span>
                                 <span className="text-sm text-slate-700 font-medium">{a.content || '(Trống)'}</span>
                               </div>
                             </div>
                           ))}
                         </div>
                    </div>
                 </div>
               )}
            </div>
         </div>
      )}
    </div>
  );
};
