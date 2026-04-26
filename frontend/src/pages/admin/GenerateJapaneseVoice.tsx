import React, { useState, useEffect, useMemo } from 'react'
import { toast } from '@/hooks/use-toast'
import {
  Play,
  Download,
  Settings,
  RefreshCw,
  AudioLines,
  FileAudio,
  Upload,
  Save,
  PlayCircle,
  Loader2,
  Plus,
  X,
  ListMusic,
  CheckCircle2,
  Circle,
  Headphones,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { ScriptEditor } from '@/features/tts/components/ScriptEditor'
import { CharacterConfig } from '@/features/tts/components/CharacterConfig'
import { ttsClient, SpeakerConfig, DialogueLine } from '@/features/tts/api/ttsClient'

// Helper to parse text into dialogues
function parseScriptText(text: string): { dialogues: DialogueLine[]; speakers: string[] } {
  const lines = text.split('\n')
  const dialogues: DialogueLine[] = []
  const speakerSet = new Set<string>()

  // Matches "Speaker Name:" or "Speaker Name："
  const speakerRegex = /^([^:：]+)[:：]\s*(.*)$/

  let currentSpeaker = ''
  let currentText = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(speakerRegex)
    if (match) {
      // If we already have a block of text, save it
      if (currentSpeaker && currentText) {
        dialogues.push({ speaker: currentSpeaker, text: currentText.trim() })
        speakerSet.add(currentSpeaker)
      }
      currentSpeaker = match[1].trim()
      currentText = match[2]
    } else {
      // If it has no colon, it's a Narrator line.
      if (currentSpeaker === 'Người dẫn chuyện') {
        currentText += ' ' + trimmed
      } else {
        if (currentSpeaker && currentText) {
          dialogues.push({ speaker: currentSpeaker, text: currentText.trim() })
          speakerSet.add(currentSpeaker)
        }
        currentSpeaker = 'Người dẫn chuyện'
        currentText = trimmed
      }
    }
  }

  // Push the last one
  if (currentSpeaker && currentText) {
    dialogues.push({ speaker: currentSpeaker, text: currentText.trim() })
    speakerSet.add(currentSpeaker)
  }

  return {
    dialogues,
    speakers: Array.from(speakerSet),
  }
}

const GenerateJapaneseVoicePage: React.FC = () => {
  const [scriptText, setScriptText] = useState<string>('')
  const [speakerConfigs, setSpeakerConfigs] = useState<Record<string, SpeakerConfig>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [pipelineStep, setPipelineStep] = useState<number>(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // Pause Settings
  const [dialoguePause, setDialoguePause] = useState<number>(1.0)
  const [narratorPause, setNarratorPause] = useState<number>(5.0)

  // Derived state
  const { dialogues, speakers } = useMemo(() => parseScriptText(scriptText), [scriptText])

  const handleDownload = async () => {
    if (!audioUrl) return
    try {
      const response = await fetch(audioUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `voice_clone_${new Date().getTime()}.wav`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: 'Không thể tải file, vui lòng thử lại',
        variant: 'destructive',
      })
    }
  }

  const handleUploadSample = async (speaker: string, file: File) => {
    toast({ title: 'Đang upload...', description: `Đang tải giọng mẫu cho ${speaker}...` })
    try {
      const data = await ttsClient.uploadSample(file)
      setSpeakerConfigs((prev) => ({
        ...prev,
        [speaker]: {
          ...(prev[speaker] || {
            model_name: speaker.includes('Nam') || speaker === '男' ? 'jvnv-M1-jp' : 'jvnv-F1-jp',
            style: 'Neutral',
            pitch_scale: 1.0,
            sdp_ratio: 0.2,
          }),
          reference_audio_url: data.file_url,
        },
      }))
      toast({ title: 'Thành công', description: `Đã lưu giọng mẫu cho nhân vật ${speaker}` })
    } catch (err: any) {
      toast({
        title: 'Lỗi',
        description: err.message || 'Lỗi khi upload giọng mẫu',
        variant: 'destructive',
      })
    }
  }

  const handleGenerate = async () => {
    if (dialogues.length === 0) {
      toast({
        title: 'Cảnh báo',
        description: 'Vui lòng nhập kịch bản để tạo audio',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setAudioUrl(null)
    setPipelineStep(1) // Bước 1: Chuẩn bị kịch bản & thiết lập model

    try {
      // Ensure all current speakers have a config
      const finalConfigs: Record<string, SpeakerConfig> = {}
      speakers.forEach((s) => {
        finalConfigs[s] = speakerConfigs[s] || {
          model_name: s.includes('Nam') || s === '男' ? 'jvnv-M1-jp' : 'jvnv-F1-jp',
          style: 'Neutral',
          pitch_scale: 1.0,
          sdp_ratio: 0.2,
        }
      })

      // Đợi một chút để giả lập bước chuẩn bị kết nối model
      await new Promise((resolve) => setTimeout(resolve, 800))
      setPipelineStep(2) // Bước 2: Tổng hợp giọng nói

      const response = await ttsClient.generateScript({
        dialogues,
        speaker_configs: finalConfigs,
        title: `Script_${new Date().getTime()}`,
        dialogue_pause: dialoguePause,
        narrator_pause: narratorPause,
      })

      setPipelineStep(3) // Bước 3: Đồng bộ dữ liệu

      // Giả lập thời gian lưu vào DB / Cloudinary nếu Backend xử lý quá nhanh
      await new Promise((resolve) => setTimeout(resolve, 800))

      setPipelineStep(4) // Hoàn tất
      setAudioUrl(response.file_url)
      toast({ title: 'Thành công', description: 'Đã tạo audio thành công!' })

      // Xoá pipeline UI sau 2 giây
      setTimeout(() => setPipelineStep(0), 2000)
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Lỗi khi tạo audio',
        variant: 'destructive',
      })
      setPipelineStep(0)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-7xl animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
            <Headphones className="w-10 h-10 text-blue-600" />
            Generate Japanese Voice
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Tự động nhận diện kịch bản và sinh giọng đọc bằng Style-Bert-VITS2
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Script Editor & Config */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
                  Hướng dẫn gõ kịch bản
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 leading-relaxed">
                  Nhập kịch bản theo cú pháp{' '}
                  <span className="font-semibold bg-blue-100 dark:bg-blue-800/50 px-1.5 py-0.5 rounded text-blue-800 dark:text-blue-200">
                    Nhãn: Lời thoại
                  </span>
                  . Ví dụ:{' '}
                  <code className="font-mono bg-blue-100 dark:bg-blue-800/50 px-1.5 py-0.5 rounded text-blue-800 dark:text-blue-200">
                    男2: こんにちは
                  </code>
                  . Các dòng không chứa dấu hai chấm (:) sẽ tự động được xếp vào nhãn{' '}
                  <b>Người dẫn chuyện</b>.
                </p>
              </div>
            </div>

            <div className="border-t border-blue-200/50 dark:border-blue-800/50 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                    Nghỉ Lời dẫn (Narrator)
                  </Label>
                  <span className="text-xs font-mono font-medium text-blue-600 bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded">
                    {narratorPause.toFixed(1)}s
                  </span>
                </div>
                <Slider
                  min={0.5}
                  max={12.0}
                  step={0.5}
                  value={[narratorPause]}
                  onValueChange={([v]) => setNarratorPause(v)}
                  className="[&_[role=slider]]:border-blue-500 [&_[role=slider]]:focus:ring-blue-500"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                    Nghỉ Hội thoại (Dialogue)
                  </Label>
                  <span className="text-xs font-mono font-medium text-blue-600 bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded">
                    {dialoguePause.toFixed(1)}s
                  </span>
                </div>
                <Slider
                  min={0.0}
                  max={5.0}
                  step={0.1}
                  value={[dialoguePause]}
                  onValueChange={([v]) => setDialoguePause(v)}
                  className="[&_[role=slider]]:border-blue-500 [&_[role=slider]]:focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <ScriptEditor value={scriptText} onChange={setScriptText} />

          <div className="pt-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" />
              <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                Reference Audio & Config
              </h2>
            </div>

            <CharacterConfig
              speakers={speakers}
              configs={speakerConfigs}
              onChange={setSpeakerConfigs}
              onUploadSample={handleUploadSample}
            />
          </div>
        </div>

        {/* Right Column: Generate Action & Result */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="border-2 shadow-lg bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-900 overflow-hidden sticky top-8">
            <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <AudioLines className="w-5 h-5 text-emerald-500" />
                  Sinh Audio
                </h3>
                <p className="text-sm text-slate-500">
                  Phát hiện <b>{speakers.length}</b> nhân vật và <b>{dialogues.length}</b> câu
                  thoại.
                </p>
              </div>

              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={isGenerating || dialogues.length === 0}
                className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30 text-lg font-bold transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Đang xử lý mô hình AI...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-6 w-6" />
                    Bắt đầu Generate
                  </>
                )}
              </Button>

              {/* Màn hình hiển thị Pipeline */}
              {isGenerating && pipelineStep > 0 && (
                <div className="mt-4 p-5 rounded-xl border border-blue-100 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800/40 space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1 tracking-wider uppercase">
                    <span>Tiến trình xử lý</span>
                    <span>
                      {pipelineStep === 1
                        ? '15%'
                        : pipelineStep === 2
                          ? '65%'
                          : pipelineStep === 3
                            ? '95%'
                            : '100%'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-in-out relative"
                      style={{
                        width:
                          pipelineStep === 1
                            ? '15%'
                            : pipelineStep === 2
                              ? '65%'
                              : pipelineStep === 3
                                ? '95%'
                                : '100%',
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <div
                      className={`flex items-center gap-3 text-sm transition-colors duration-300 ${pipelineStep >= 1 ? 'text-blue-700 dark:text-blue-400 font-semibold' : 'text-slate-400 dark:text-slate-600'}`}
                    >
                      {pipelineStep > 1 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 drop-shadow-sm" />
                      ) : pipelineStep === 1 ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      ) : (
                        <Circle className="w-5 h-5 opacity-50" />
                      )}
                      1. Chuẩn bị kịch bản & thiết lập model
                    </div>
                    <div
                      className={`flex items-center gap-3 text-sm transition-colors duration-300 ${pipelineStep >= 2 ? 'text-blue-700 dark:text-blue-400 font-semibold' : 'text-slate-400 dark:text-slate-600'}`}
                    >
                      {pipelineStep > 2 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 drop-shadow-sm" />
                      ) : pipelineStep === 2 ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      ) : (
                        <Circle className="w-5 h-5 opacity-50" />
                      )}
                      2. Tổng hợp giọng nói đa nhân vật
                    </div>
                    <div
                      className={`flex items-center gap-3 text-sm transition-colors duration-300 ${pipelineStep >= 3 ? 'text-blue-700 dark:text-blue-400 font-semibold' : 'text-slate-400 dark:text-slate-600'}`}
                    >
                      {pipelineStep > 3 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 drop-shadow-sm" />
                      ) : pipelineStep === 3 ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      ) : (
                        <Circle className="w-5 h-5 opacity-50" />
                      )}
                      3. Tối ưu hóa và đồng bộ dữ liệu
                    </div>
                  </div>
                </div>
              )}

              {audioUrl && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                    <h3 className="font-bold text-emerald-600 dark:text-emerald-400">
                      ✅ Kết quả Audio
                    </h3>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none border-red-200 hover:bg-red-50 text-red-600 dark:border-red-800/50 dark:hover:bg-red-900/30 dark:text-red-400"
                        onClick={() => setAudioUrl(null)}
                      >
                        Huỷ / Sinh lại
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={handleDownload}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Tải về
                      </Button>
                    </div>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 shadow-inner border border-slate-200 dark:border-slate-700">
                    <audio src={audioUrl} controls className="w-full h-12 outline-none" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default GenerateJapaneseVoicePage
