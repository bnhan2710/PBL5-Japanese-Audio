interface TestAudioPlayerProps {
  title?: string
  url?: string | null
  compact?: boolean
  mode?: 'practice' | 'simulation'
  autoPlaySignal?: number
}

export function TestAudioPlayer({ url }: TestAudioPlayerProps) {
  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-3 text-sm text-muted-foreground text-center">
        Chưa có audio khả dụng cho phần này.
      </div>
    )
  }

  return (
    <audio
      src={url}
      controls
      preload="metadata"
      className="w-full"
    />
  )
}
