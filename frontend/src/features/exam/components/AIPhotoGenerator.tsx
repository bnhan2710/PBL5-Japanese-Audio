import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react'

import { toast } from '@/hooks/use-toast'
import { aiPhotoClient, type AIPhotoType } from '../api/aiPhotoClient'

interface AIPhotoGeneratorProps {
  questionText?: string
  scriptText?: string
  answers?: Array<{ content?: string | null }> | string[]
  onSelectImage: (file: File, previewUrl: string) => void
}

function normalizeAnswers(answers?: Array<{ content?: string | null }> | string[]) {
  if (!answers) return []
  return answers
    .map((a) => (typeof a === 'string' ? a : a.content || ''))
    .map((a) => a.trim())
    .filter(Boolean)
}

async function dataUrlToFile(dataUrl: string, photoType: AIPhotoType) {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const ext = blob.type.includes('png') ? 'png' : 'jpg'
  return new File([blob], `ai-photo-${photoType}-${Date.now()}.${ext}`, {
    type: blob.type || 'image/png',
  })
}

export default function AIPhotoGenerator({
  questionText,
  scriptText,
  answers,
  onSelectImage,
}: AIPhotoGeneratorProps) {
  const [expanded, setExpanded] = useState(false)
  const [photoType, setPhotoType] = useState<AIPhotoType>('context')
  const [detailPrompt, setDetailPrompt] = useState('')
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)

  const normalizedAnswers = normalizeAnswers(answers)
  const hasFourAnswers = normalizedAnswers.length >= 4

  const handleGenerate = async () => {
    const userPrompt = detailPrompt.trim()

    if (!userPrompt) {
      toast({
        title: 'Thiếu prompt sinh ảnh',
        description: 'Hãy nhập prompt mô tả cảnh cần sinh ảnh trước khi tạo.',
        variant: 'destructive',
      })
      return
    }

    if (photoType === 'action' && !hasFourAnswers) {
      toast({
        title: 'Chưa đủ 4 lựa chọn',
        description: 'Sinh ảnh hành động cần đủ 4 đáp án.',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setGeneratedImageUrl(null)

    try {
      const result = await aiPhotoClient.generate({
        photo_type: photoType,
        description: userPrompt,
        question_text: questionText?.trim() || null,
        script: scriptText?.trim() || null,
        answers: photoType === 'action' ? normalizedAnswers.slice(0, 4) : normalizedAnswers,
      })
      setGeneratedImageUrl(result.b64_image)
      setGeneratedPrompt(result.info ?? null)
    } catch (error: any) {
      toast({
        title: 'Sinh ảnh thất bại',
        description: error.message || 'Không thể kết nối Draw Things.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSelect = async () => {
    if (!generatedImageUrl) return
    setIsSelecting(true)
    try {
      const file = await dataUrlToFile(generatedImageUrl, photoType)
      onSelectImage(file, URL.createObjectURL(file))
      toast({ title: 'Đã chọn ảnh AI' })
      setGeneratedImageUrl(null)
      setExpanded(false)
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' })
    } finally {
      setIsSelecting(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-blue-500/10"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Sinh ảnh AI</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-blue-400" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-blue-400" />
        )}
      </button>

      {/* Inline body — no modal */}
      {expanded && (
        <div className="space-y-3 border-t border-blue-500/20 p-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(['context', 'action'] as AIPhotoType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setPhotoType(t)
                  setGeneratedImageUrl(null)
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                  photoType === t
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-card text-muted-foreground hover:bg-muted border border-border'
                }`}
              >
                {t === 'context' ? '🖼 Ngữ cảnh (1 ảnh)' : '🔲 Hành động (4 ô A/B/C/D)'}
              </button>
            ))}
          </div>

          {photoType === 'action' && !hasFourAnswers && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              ⚠ Cần đủ 4 đáp án để sinh ảnh hành động 2×2.
            </p>
          )}

          {/* Description textarea */}
          <textarea
            value={detailPrompt}
            onChange={(e) => setDetailPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleGenerate()
              }
            }}
            rows={2}
            placeholder="Mô tả chi tiết cảnh ảnh cần sinh... (Enter để sinh nhanh)"
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-400 dark:text-muted-foreground"
          />

          {/* Generate button */}
          <div className="flex items-center gap-3">
            <div className="relative inline-flex">
              {isGenerating && (
                <span className="absolute inset-0 animate-ping rounded-full bg-blue-500 opacity-25" />
              )}
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || (photoType === 'action' && !hasFourAnswers)}
                className={`relative inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white shadow-md transition-all disabled:opacity-60 ${
                  isGenerating
                    ? 'bg-blue-700 ring-4 ring-blue-500/30'
                    : 'bg-blue-600 hover:bg-blue-500 active:scale-95'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang sinh...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> Sinh ảnh
                  </>
                )}
              </button>
            </div>
            {generatedImageUrl && !isGenerating && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                ✓ Ảnh đã sẵn sàng
              </p>
            )}
          </div>

          {/* Generated preview + select */}
          {generatedImageUrl && (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-xl border border-border bg-muted">
                <img
                  src={generatedImageUrl}
                  alt="AI generated preview"
                  className="aspect-square w-full object-contain"
                />
              </div>
              {generatedPrompt && (
                <p className="line-clamp-2 text-[11px] text-muted-foreground">
                  Prompt: {generatedPrompt}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSelect()}
                  disabled={isSelecting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                >
                  {isSelecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Dùng ảnh này
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedImageUrl(null)
                    setGeneratedPrompt(null)
                  }}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted"
                >
                  Thử lại
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
