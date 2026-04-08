import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Volume2, Rewind, FastForward, Headphones } from 'lucide-react'

interface TestAudioPlayerProps {
 title: string
 url?: string | null
 compact?: boolean
 mode?: 'practice' | 'simulation'
 autoPlaySignal?: number
}

function formatTime(value: number) {
 if (!Number.isFinite(value) || value < 0) return '00:00'
 const minutes = Math.floor(value / 60)
 const seconds = Math.floor(value % 60)
 return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function TestAudioPlayer({
 title,
 url,
 compact = false,
 mode = 'practice',
 autoPlaySignal = 0,
}: TestAudioPlayerProps) {
 const audioRef = useRef<HTMLAudioElement>(null)
 const [isPlaying, setIsPlaying] = useState(false)
 const [progress, setProgress] = useState(0)
 const [duration, setDuration] = useState(0)
 const [volume, setVolume] = useState(0.9)
 const [playbackRate, setPlaybackRate] = useState(1)

 useEffect(() => {
 setIsPlaying(false)
 setProgress(0)
 setDuration(0)
 if (audioRef.current) {
 audioRef.current.pause()
 audioRef.current.load()
 }
 }, [url])

 useEffect(() => {
 if (!audioRef.current) return
 audioRef.current.volume = volume
 }, [volume])

 useEffect(() => {
 if (!audioRef.current) return
 audioRef.current.playbackRate = playbackRate
 }, [playbackRate])

 useEffect(() => {
 if (!audioRef.current || !url || autoPlaySignal <= 0 || mode !== 'practice') return
 void audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
 }, [autoPlaySignal, mode, url])

 const toggle = async () => {
 if (!audioRef.current || !url) return
 if (isPlaying) {
 audioRef.current.pause()
 setIsPlaying(false)
 return
 }

 try {
 await audioRef.current.play()
 setIsPlaying(true)
 } catch {
 setIsPlaying(false)
 }
 }

 const seek = (nextValue: number) => {
 if (!audioRef.current) return
 audioRef.current.currentTime = nextValue
 setProgress(nextValue)
 }

 const jump = (delta: number) => {
 if (!audioRef.current) return
 const nextValue = Math.max(0, Math.min(duration, audioRef.current.currentTime + delta))
 seek(nextValue)
 }

 if (!url) {
 return (
 <div className="rounded-2xl border border-dashed border-border bg-slate-50 px-5 py-4 text-sm text-muted-foreground">
 Chưa có audio khả dụng cho phần này.
 </div>
 )
 }

 if (mode === 'simulation') {
 return (
 <div
 className={[
 'rounded-[28px] border border-blue-100 bg-gradient-to-br from-sky-50 via-white to-blue-50 shadow-sm',
 compact ? 'px-4 py-4' : 'px-5 py-5',
 ].join(' ')}
 >
 <div className="flex items-center gap-4">
 <div
 className={[
 'flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white animate-[pulse_2s_ease-in-out_infinite] shadow-lg shadow-blue-500/20',
 compact ? 'h-12 w-12' : 'h-14 w-14',
 ].join(' ')}
 >
 <Headphones className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
 </div>
 <div className="min-w-0 flex-1">
 <h3 className={compact ? 'text-base font-bold text-foreground' : 'text-xl font-bold text-foreground'}>
 {title}
 </h3>
 <p className="text-sm font-medium text-muted-foreground mt-0.5">
 Audio đang phát liên tục trong nền...
 </p>
 </div>
 </div>
 </div>
 )
 }

 return (
 <div
 className={[
 'rounded-[28px] border border-blue-100 bg-gradient-to-br from-sky-50 via-white to-blue-50 shadow-sm',
 compact ? 'px-4 py-4' : 'px-5 py-5',
 ].join(' ')}
 >
 <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
 <div className="flex items-center gap-4 lg:min-w-0 lg:flex-1">
 <div
 className={[
 'flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20',
 compact ? 'h-12 w-12' : 'h-14 w-14',
 ].join(' ')}
 >
 <Headphones className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
 </div>
 <div className="min-w-0 flex-1">
 <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
 <h3 className={compact ? 'text-base font-bold text-foreground' : 'text-xl font-bold text-foreground'}>
 {title}
 </h3>
 <p className="text-sm font-medium text-muted-foreground">
 {formatTime(progress)} / {duration > 0 ? formatTime(duration) : '--:--'}
 </p>
 </div>
 <input
 type="range"
 min={0}
 max={duration || 1}
 step={0.01}
 value={progress}
 onChange={(event) => seek(Number(event.target.value))}
 className="h-2 w-full cursor-pointer appearance-none rounded-full bg-blue-100 accent-blue-500"
 />
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-3 lg:justify-end">
 <button
 type="button"
 onClick={() => jump(-10)}
 className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-blue-300 hover:text-blue-600"
 >
 <Rewind className="h-4 w-4" />
 </button>
 <button
 type="button"
 onClick={toggle}
 className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 transition-colors hover:bg-blue-600"
 >
 {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
 </button>
 <button
 type="button"
 onClick={() => jump(10)}
 className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-blue-300 hover:text-blue-600"
 >
 <FastForward className="h-4 w-4" />
 </button>
 <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:border-blue-300 transition-colors">
 <select
 value={playbackRate}
 onChange={(e) => setPlaybackRate(Number(e.target.value))}
 className="bg-transparent outline-none cursor-pointer text-center hover:text-blue-600 transition-colors pl-1"
 >
 <option value={0.5}>0.5x</option>
 <option value={0.75}>0.75x</option>
 <option value={1}>1.0x</option>
 <option value={1.25}>1.25x</option>
 <option value={1.5}>1.5x</option>
 </select>
 </div>
 <div className="flex min-w-[132px] items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
 <Volume2 className="h-4 w-4 text-muted-foreground" />
 <input
 type="range"
 min={0}
 max={1}
 step={0.05}
 value={volume}
 onChange={(event) => setVolume(Number(event.target.value))}
 className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500"
 />
 </div>
 </div>
 </div>

 <audio
 ref={audioRef}
 src={url}
 preload="metadata"
 onEnded={() => {
 setIsPlaying(false)
 setProgress(0)
 }}
 onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
 onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
 onPause={() => setIsPlaying(false)}
 onPlay={() => setIsPlaying(true)}
 className="hidden"
 />
 </div>
 )
}
