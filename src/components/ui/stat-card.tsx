import * as React from "react"
import { cn } from "@/lib/utils"
import { ArrowUpRight } from "lucide-react"

interface StatCardProps extends React.ComponentProps<"div"> {
    title: string
    value: string | number
    trend?: string
    trendUp?: boolean
    variant?: "default" | "primary"
    icon?: React.ReactNode
}

function StatCard({
    className,
    title,
    value,
    trend,
    trendUp = true,
    variant = "default",
    icon,
    ...props
}: StatCardProps) {
    const isPrimary = variant === "primary"

    return (
        <div
            data-slot="stat-card"
            className={cn(
                "flex flex-col gap-3 rounded-2xl p-5 transition-all duration-200",
                isPrimary
                    ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground",
                className
            )}
            {...props}
        >
            <div className="flex items-center justify-between">
                <span className={cn(
                    "text-sm font-medium",
                    isPrimary ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                    {title}
                </span>
                {icon && (
                    <div className={cn(
                        "flex items-center justify-center rounded-lg p-1.5",
                        isPrimary ? "bg-white/20" : "bg-muted"
                    )}>
                        {icon}
                    </div>
                )}
            </div>
            <div className="flex items-end justify-between">
                <span className={cn(
                    "text-3xl font-bold tracking-tight",
                    isPrimary ? "text-primary-foreground" : "text-foreground"
                )}>
                    {value}
                </span>
                {trend && (
                    <div className={cn(
                        "flex items-center gap-1 text-xs font-medium rounded-full px-2 py-1",
                        trendUp
                            ? isPrimary ? "bg-white/20 text-white" : "bg-success/10 text-success"
                            : isPrimary ? "bg-white/20 text-white" : "bg-destructive/10 text-destructive"
                    )}>
                        <ArrowUpRight className={cn("h-3 w-3", !trendUp && "rotate-90")} />
                        {trend}
                    </div>
                )}
            </div>
        </div>
    )
}

export { StatCard }
export type { StatCardProps }
