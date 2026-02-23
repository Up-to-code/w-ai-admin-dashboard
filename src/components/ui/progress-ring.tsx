import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressRingProps extends React.ComponentProps<"div"> {
    value: number
    max?: number
    size?: number
    strokeWidth?: number
    showLabel?: boolean
    label?: string
}

function ProgressRing({
    className,
    value,
    max = 100,
    size = 120,
    strokeWidth = 10,
    showLabel = true,
    label,
    ...props
}: ProgressRingProps) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (percentage / 100) * circumference

    return (
        <div
            data-slot="progress-ring"
            className={cn("relative inline-flex items-center justify-center", className)}
            {...props}
        >
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
            >
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-muted"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-500 ease-out"
                />
            </svg>
            {showLabel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">
                        {Math.round(percentage)}%
                    </span>
                    {label && (
                        <span className="text-xs text-muted-foreground">
                            {label}
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}

export { ProgressRing }
export type { ProgressRingProps }
