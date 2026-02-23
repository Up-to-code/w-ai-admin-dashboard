"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, Mic } from "lucide-react"
import { cn } from "@/lib/utils"
// import { Avatar, AvatarFallback } from "@/components/ui/avatar" // Optional: for sender avatar if needed

interface AudioPlayerProps {
    src: string
    isOutbound?: boolean
}

export function AudioPlayer({ src, isOutbound }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const updateProgress = () => {
            setProgress((audio.currentTime / audio.duration) * 100)
        }

        const handleLoadedMetadata = () => {
            setDuration(audio.duration)
        }

        const handleEnded = () => {
            setIsPlaying(false)
            setProgress(0)
            audio.currentTime = 0
        }

        audio.addEventListener("timeupdate", updateProgress)
        audio.addEventListener("loadedmetadata", handleLoadedMetadata)
        audio.addEventListener("ended", handleEnded)

        return () => {
            audio.removeEventListener("timeupdate", updateProgress)
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
            audio.removeEventListener("ended", handleEnded)
        }
    }, [])

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause()
            } else {
                audioRef.current.play()
            }
            setIsPlaying(!isPlaying)
        }
    }

    const formatTime = (seconds: number) => {
        if (!seconds) return "0:00"
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="flex items-center gap-3 min-w-[280px] py-1">
            {/* Hidden Audio Element */}
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Sender Avatar Placeholder (WhatsApp style usually has the Mic/Avatar on the left) */}
            <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-muted/20 relative">
                    <Mic className={cn("h-6 w-6", isOutbound ? "text-[#00a884] dark:text-[#00a884]" : "text-muted-foreground")} />
                </div>
                {/* Small Badge icon (e.g. Mic) */}
                <div className={cn("absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center", isOutbound ? "bg-[#25d366]" : "bg-muted-foreground")}>
                    <Mic className="h-2.5 w-2.5 text-white" />
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-3">
                    <button
                        onClick={togglePlay}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {isPlaying ? (
                            <Pause className="h-6 w-6 fill-current" />
                        ) : (
                            <Play className="h-6 w-6 fill-current" />
                        )}
                    </button>
                    <div className="flex-1 h-3 flex items-center gap-0.5 opacity-60">
                        {/* Simulated Waveform using Bars. In a real app complexity, this would be canvas based on audio data. */}
                        {/* We mock it with some CSS bars that opacity change on progress */}
                        {[...Array(30)].map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "w-1 rounded-full transition-colors",
                                    (i / 30) * 100 < progress ? (isOutbound ? "bg-[#005c4b] dark:bg-[#00a884]" : "bg-primary") : "bg-muted-foreground/30"
                                )}
                                style={{ height: `${30 + Math.random() * 70}%` }}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                    <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    )
}
