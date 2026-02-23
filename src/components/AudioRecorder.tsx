"use client"

import { useState, useRef, useEffect } from "react"
import { Trash2, Mic, SendHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AudioRecorderProps {
    onRecordingComplete: (file: File) => void
    onCancel: () => void
}

export function AudioRecorder({ onRecordingComplete, onCancel }: AudioRecorderProps) {
    const [duration, setDuration] = useState(0)
    const mediaRecorder = useRef<MediaRecorder | null>(null)
    const chunks = useRef<Blob[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const [isFinishing, setIsFinishing] = useState(false)

    useEffect(() => {
        startRecording()
        return () => stopRecording()
    }, [])

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            mediaRecorder.current = new MediaRecorder(stream)
            chunks.current = []

            mediaRecorder.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.current.push(e.data)
            }

            // Important: Handle stop event to actually process the file
            mediaRecorder.current.onstop = () => {
                // Nothing specific here, we handle file creation in handleFinish's timeout or explicit flow
                // But strictly speaking, we generate the blob AFTER the stop event fires.
            }

            mediaRecorder.current.start()

            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1)
            }, 1000)

        } catch (error) {
            console.error("Microphone access denied", error)
            onCancel()
        }
    }

    const stopRecording = () => {
        if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
            mediaRecorder.current.stop()
            mediaRecorder.current.stream.getTracks().forEach(track => track.stop())
        }
        if (timerRef.current) clearInterval(timerRef.current)
    }

    const handleFinish = () => {
        if (isFinishing) return // Prevent double clicks
        setIsFinishing(true)

        stopRecording()

        // Small delay to ensure the last chunk is captured
        setTimeout(() => {
            if (chunks.current.length === 0) {
                console.error("No audio chunks recorded")
                onCancel()
                return
            }
            const blob = new Blob(chunks.current, { type: "audio/webm" })
            const file = new File([blob], "voice_note.webm", { type: "audio/webm" })
            onRecordingComplete(file)
        }, 200)
    }

    const handleCancel = () => {
        stopRecording()
        onCancel()
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="flex items-center gap-3 w-full animate-in slide-in-from-bottom duration-200 h-full px-2" dir="ltr">
            <Button variant="ghost" size="icon" onClick={handleCancel} className="text-muted-foreground hover:text-destructive shrink-0 h-10 w-10">
                <Trash2 className="h-5 w-5" />
            </Button>

            <div className="flex-1 flex items-center gap-3 h-10 bg-background/50 rounded-full px-4 border border-border/10">
                {/* Red Dot & Timer */}
                <div className="flex items-center gap-2 text-red-500 shrink-0 min-w-[60px]">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-medium tabular-nums text-foreground">{formatTime(duration)}</span>
                </div>

                {/* Wavy Animation Visualization */}
                <div className="flex-1 flex items-center justify-center h-full gap-0.5 overflow-hidden opacity-50 mask-gradient-to-r">
                    {[...Array(40)].map((_, i) => (
                        <div
                            key={i}
                            className="w-1 bg-foreground rounded-full animate-wave"
                            style={{
                                height: '20%',
                                animationDelay: `${Math.random() * 0.5}s`,
                                animationDuration: `${0.5 + Math.random() * 0.5}s`
                            }}
                        />
                    ))}
                    <style jsx>{`
                        @keyframes wave {
                            0%, 100% { height: 20%; }
                            50% { height: 80%; }
                        }
                        .animate-wave {
                            animation: wave 1s infinite ease-in-out;
                        }
                    `}</style>
                </div>
            </div>

            <Button
                onClick={handleFinish}
                disabled={isFinishing}
                className="h-10 w-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white shrink-0 flex items-center justify-center p-0"
            >
                {isFinishing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <SendHorizontal className="h-5 w-5 ml-0.5" />
                )}
            </Button>
        </div>
    )
}
