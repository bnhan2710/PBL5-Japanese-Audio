import React from 'react';
import { ManualExamBuilder } from './components/ManualExamBuilder';

export default function CreateExamPage() {
  return (
    <div className="p-8 pb-32">
      <div className="mb-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Tạo đề thi thủ công</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Thiết lập cấu trúc đề, biên tập nội dung, sau đó upload toàn bộ lên máy chủ cùng một lúc.</p>
      </div>
      <ManualExamBuilder />
    </div>
  );
}
