import { useState } from 'react'
import { Check, ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react'

import { toast } from '@/hooks/use-toast'
import { aiPhotoClient, type AIPhotoType } from '../api/aiPhotoClient'

interface AIPhotoGeneratorProps {
 currentImageUrl?: string | null
 questionText?: string
 scriptText?: string
 answers?: Array<{ content?: string | null }> | string[]
 onSelectImage: (file: File, previewUrl: string) => void
 onRemoveImage: () => void
}

function normalizeAnswers(answers?: Array<{ content?: string | null }> | string[]) {
 if (!answers) return []
 return answers
 .map((answer) => (typeof answer === 'string' ? answer : answer.content || ''))
 .map((answer) => answer.trim())
}

function buildPrompt({
 photoType,
 detailPrompt,
 questionText,
 scriptText,
 answers,
}: {
 photoType: AIPhotoType
 detailPrompt: string
 questionText?: string
 scriptText?: string
 answers: string[]
}) {
 const sections = [
 `Loai anh: ${photoType === 'context' ? 'Sinh anh ngu canh' : 'Sinh anh hanh dong 4 o'}`,
 questionText?.trim() ? `Noi dung cau hoi: ${questionText.trim()}` : '',
 scriptText?.trim() ? `Kich ban hoi thoai / ngu canh: ${scriptText.trim()}` : '',
 answers.length > 0
 ? `Lua chon hien co:\n${answers.map((answer, index) => `${String.fromCharCode(65 + index)}. ${answer}`).join('\n')}`
 : '',
 detailPrompt.trim() ? `Mo ta bo sung cua nguoi dung: ${detailPrompt.trim()}` : 'Mo ta bo sung cua nguoi dung: khong co',
 ]

 return sections.filter(Boolean).join('\n\n')
}

async function dataUrlToFile(dataUrl: string, photoType: AIPhotoType) {
 const response = await fetch(dataUrl)
 const blob = await response.blob()
 const extension = blob.type.includes('png') ? 'png' : 'jpg'
 const fileName = `ai-photo-${photoType}-${Date.now()}.${extension}`
 return new File([blob], fileName, { type: blob.type || 'image/png' })
}

export default function AIPhotoGenerator({
 currentImageUrl,
 questionText,
 scriptText,
 answers,
 onSelectImage,
 onRemoveImage,
}: AIPhotoGeneratorProps) {
 const [photoType, setPhotoType] = useState<AIPhotoType>('context')
 const [detailPrompt, setDetailPrompt] = useState('')
 const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
 const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null)
 const [isGenerating, setIsGenerating] = useState(false)
 const [isSelecting, setIsSelecting] = useState(false)

 const normalizedAnswers = normalizeAnswers(answers)
 const hasFourAnswers = normalizedAnswers.filter(Boolean).length >= 4

 const handleGenerate = async (type: AIPhotoType = photoType) => {
 if (type === 'action' && !hasFourAnswers) {
 toast({
 title: 'Chưa đủ 4 lựa chọn',
 description: 'Sinh ảnh hành động cần đủ 4 đáp án để tạo 4 ô tương ứng.',
 variant: 'destructive',
 })
 return
 }

 setPhotoType(type)
 setIsGenerating(true)

 try {
 const payloadPrompt = buildPrompt({
 photoType: type,
 detailPrompt,
 questionText,
 scriptText,
 answers: normalizedAnswers,
 })
 const result = await aiPhotoClient.generate({
 prompt: payloadPrompt,
 photo_type: type,
 })
 setGeneratedImageUrl(result.b64_image)
 setGeneratedPrompt(result.info ?? null)
 toast({
 title: 'Đã sinh ảnh',
 description: type === 'context' ? 'Ảnh ngữ cảnh đã sẵn sàng để chọn.' : 'Ảnh hành động 4 ô đã sẵn sàng để chọn.',
 })
 } catch (error: any) {
 toast({
 title: 'Sinh ảnh thất bại',
 description: error.message || 'Không thể sinh ảnh lúc này.',
 variant: 'destructive',
 })
 } finally {
 setIsGenerating(false)
 }
 }

 const handlePickGeneratedImage = async () => {
 if (!generatedImageUrl) return
 setIsSelecting(true)
 try {
 const file = await dataUrlToFile(generatedImageUrl, photoType)
 onSelectImage(file, URL.createObjectURL(file))
 toast({
 title: 'Đã chọn ảnh AI',
 description: 'Ảnh sẽ được lưu lên Cloudinary khi bạn lưu câu hỏi.',
 })
 } catch (error: any) {
 toast({
 title: 'Không thể chọn ảnh',
 description: error.message || 'Ảnh sinh ra không hợp lệ.',
 variant: 'destructive',
 })
 } finally {
 setIsSelecting(false)
 }
 }

 return (
 <div className="space-y-4 rounded-xl border border-border bg-slate-50/70 p-4">
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => setPhotoType('context')}
 className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
 photoType === 'context'
 ? 'bg-blue-600 text-white'
 : 'bg-card text-muted-foreground hover:bg-muted dark:text-muted-foreground '
 }`}
 >
 Sinh ảnh ngữ cảnh
 </button>
 <button
 type="button"
 onClick={() => setPhotoType('action')}
 className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
 photoType === 'action'
 ? 'bg-blue-600 text-white'
 : 'bg-card text-muted-foreground hover:bg-muted dark:text-muted-foreground '
 }`}
 >
 Sinh ảnh hành động
 </button>
 <button
 type="button"
 onClick={() => void handleGenerate(photoType)}
 disabled={isGenerating}
 className="ml-auto inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
 >
 {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
 Sinh ảnh
 </button>
 </div>

 <div className="space-y-2">
 <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
 Mô tả chi tiết ảnh
 </label>
 <textarea
 value={detailPrompt}
 onChange={(e) => setDetailPrompt(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault()
 void handleGenerate(photoType)
 }
 }}
 rows={3}
 placeholder="Nhập mô tả bổ sung, ví dụ: người đàn ông có mũi tên chỉ vào sẽ nói gì, góc nhìn lớp học, biểu cảm..."
 className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-400 dark:text-muted-foreground"
 />
 <p className="text-[11px] text-muted-foreground">
 Nhấn <span className="font-semibold">Enter</span> để sinh nhanh. Dùng <span className="font-semibold">Shift + Enter</span> để xuống dòng.
 </p>
 </div>

 {photoType === 'action' && !hasFourAnswers ? (
 <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
 Chế độ ảnh hành động đang cần đủ 4 lựa chọn để tạo ảnh 2x2 tương ứng với 4 đáp án.
 </div>
 ) : null}

 {generatedImageUrl ? (
 <div className="space-y-3 rounded-xl border border-border bg-card p-3">
 <img
 src={generatedImageUrl}
 alt="AI generated"
 className="max-h-80 w-full rounded-lg border border-border object-contain"
 />
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => void handlePickGeneratedImage()}
 disabled={isSelecting}
 className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
 >
 {isSelecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
 Chọn ảnh này
 </button>
 <button
 type="button"
 onClick={() => {
 setGeneratedImageUrl(null)
 setGeneratedPrompt(null)
 }}
 className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted dark:text-muted-foreground"
 >
 <Trash2 className="h-3.5 w-3.5" />
 Xoá kết quả sinh
 </button>
 </div>
 {generatedPrompt ? (
 <p className="text-[11px] leading-relaxed text-muted-foreground">
 Prompt dùng để sinh: {generatedPrompt}
 </p>
 ) : null}
 </div>
 ) : null}

 <div className="flex flex-wrap items-center gap-2">
 <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
 <ImagePlus className="h-3.5 w-3.5" />
 Ảnh hiện tại
 </span>
 {currentImageUrl ? (
 <button
 type="button"
 onClick={onRemoveImage}
 className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
 >
 <Trash2 className="h-3.5 w-3.5" />
 Xoá ảnh đã chọn
 </button>
 ) : (
 <span className="text-xs text-muted-foreground">Chưa có ảnh nào được chọn cho câu hỏi này.</span>
 )}
 </div>
 </div>
 )
}
