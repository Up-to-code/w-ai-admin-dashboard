"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock } from "lucide-react"
import { format, addDays, addMonths, isSameDay, parse } from "date-fns"
import { ar } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface CronSchedulerProps {
  value?: string
  onChange: (cronExpression: string) => void
  label?: string
}

type ScheduleType = "daily" | "weekly" | "monthly" | "yearly"

// Arabic day names mapping (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
const ARABIC_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const ENGLISH_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

// Arabic month names (1-12)
const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
]

// Utility functions for cron generation and validation
function validateCronExpression(cron: string): boolean {
  const cronRegex = /^(\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|[12][0-9]|3[01])|\*\/([1-9]|[12][0-9]|3[01])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
  return cronRegex.test(cron.trim())
}

function generateDailyCron(hour: number, minute: number): string {
  return `${minute} ${hour} * * *`
}

function generateWeeklyCron(hour: number, minute: number, days: number[]): string {
  if (days.length === 0) return ""
  const dayOfWeek = days.sort((a, b) => a - b).join(",")
  return `${minute} ${hour} * * ${dayOfWeek}`
}

function generateMonthlyCron(hour: number, minute: number, dayOfMonth: number): string {
  return `${minute} ${hour} ${dayOfMonth} * *`
}

function generateYearlyCron(hour: number, minute: number, month: number, dayOfMonth: number): string {
  return `${minute} ${hour} ${dayOfMonth} ${month} *`
}

function parseCronExpression(cron: string): {
  type: ScheduleType
  hour: number
  minute: number
  days?: number[]
  dayOfMonth?: number
  month?: number
} | null {
  if (!validateCronExpression(cron)) return null

  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [minute, hour, day, month, weekday] = parts

  const parsedHour = hour === "*" ? 9 : parseInt(hour, 10)
  const parsedMinute = minute === "*" ? 0 : parseInt(minute, 10)

  // Determine type based on pattern
  if (day !== "*" && month !== "*" && weekday === "*") {
    // Yearly pattern (has specific day and month, no weekday)
    return { 
      type: "yearly", 
      hour: parsedHour, 
      minute: parsedMinute, 
      dayOfMonth: parseInt(day, 10),
      month: parseInt(month, 10)
    }
  } else if (weekday !== "*" && day === "*" && month === "*") {
    // Weekly pattern
    const days = weekday.split(",").map(d => parseInt(d, 10))
    return { type: "weekly", hour: parsedHour, minute: parsedMinute, days }
  } else if (day !== "*" && weekday === "*" && month === "*") {
    // Monthly pattern
    return { type: "monthly", hour: parsedHour, minute: parsedMinute, dayOfMonth: parseInt(day, 10) }
  } else if (day === "*" && weekday === "*" && month === "*") {
    // Daily pattern
    return { type: "daily", hour: parsedHour, minute: parsedMinute }
  }

  // If pattern doesn't match known types, return null (fallback to daily)
  return null
}

function getNextRuns(cron: string, count: number = 3): Date[] {
  if (!validateCronExpression(cron)) return []

  const parsed = parseCronExpression(cron)
  if (!parsed) return []

  const now = new Date()
  const runs: Date[] = []

  // Simple calculation for next runs (this is a simplified version)
  // For production, consider using a library like `node-cron` or `cron-parser`
  for (let i = 0; i < count; i++) {
    const next = new Date(now)
    next.setHours(parsed.hour, parsed.minute, 0, 0)
    
    if (next <= now) {
      if (parsed.type === "daily") {
        next.setDate(next.getDate() + 1 + i)
      } else if (parsed.type === "weekly" && parsed.days) {
        const currentDay = now.getDay()
        const nextDay = parsed.days.find(d => d > currentDay) || parsed.days[0]
        const daysToAdd = nextDay > currentDay ? nextDay - currentDay : 7 - currentDay + nextDay
        next.setDate(next.getDate() + daysToAdd + (i * 7))
      } else if (parsed.type === "monthly" && parsed.dayOfMonth) {
        next.setDate(parsed.dayOfMonth)
        if (next <= now) {
          next.setMonth(next.getMonth() + 1 + i)
        } else {
          next.setMonth(next.getMonth() + i)
        }
      } else if (parsed.type === "yearly" && parsed.dayOfMonth && parsed.month) {
        next.setMonth(parsed.month - 1) // JavaScript months are 0-indexed
        next.setDate(parsed.dayOfMonth)
        if (next <= now) {
          next.setFullYear(next.getFullYear() + 1 + i)
        } else {
          next.setFullYear(next.getFullYear() + i)
        }
      } else {
        next.setDate(next.getDate() + 1 + i)
      }
    } else {
      if (i > 0) {
        if (parsed.type === "daily") {
          next.setDate(next.getDate() + i)
        } else if (parsed.type === "weekly") {
          next.setDate(next.getDate() + (i * 7))
        } else if (parsed.type === "monthly") {
          next.setMonth(next.getMonth() + i)
        } else if (parsed.type === "yearly") {
          next.setFullYear(next.getFullYear() + i)
        }
      }
    }
    
    runs.push(next)
  }

  return runs
}

export function CronScheduler({ value = "", onChange, label }: CronSchedulerProps) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>("daily")
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState(0)
  const [selectedDays, setSelectedDays] = useState<number[]>([1]) // Monday by default
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [month, setMonth] = useState(1) // January by default for yearly

  // Parse existing cron expression on mount
  useEffect(() => {
    if (value && validateCronExpression(value)) {
      const parsed = parseCronExpression(value)
      if (parsed) {
        setScheduleType(parsed.type)
        setHour(parsed.hour)
        setMinute(parsed.minute)
        if (parsed.days) setSelectedDays(parsed.days)
        if (parsed.dayOfMonth) setDayOfMonth(parsed.dayOfMonth)
        if (parsed.month) setMonth(parsed.month)
      }
    }
  }, [value])

  // Generate cron expression when settings change
  useEffect(() => {
    let cron = ""
    if (scheduleType === "daily") {
      cron = generateDailyCron(hour, minute)
    } else if (scheduleType === "weekly") {
      cron = generateWeeklyCron(hour, minute, selectedDays)
    } else if (scheduleType === "monthly") {
      cron = generateMonthlyCron(hour, minute, dayOfMonth)
    } else if (scheduleType === "yearly") {
      cron = generateYearlyCron(hour, minute, month, dayOfMonth)
    }
    if (cron) onChange(cron)
  }, [scheduleType, hour, minute, selectedDays, dayOfMonth, month, onChange])

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    )
  }

  const nextRuns = value && validateCronExpression(value) ? getNextRuns(value, 3) : []

  // Preset options
  const presets = [
    { label: "كل يوم 9 صباحاً", cron: "0 9 * * *", type: "daily" as ScheduleType },
    { label: "كل إثنين 9 صباحاً", cron: "0 9 * * 1", type: "weekly" as ScheduleType },
    { label: "أول يوم من كل شهر 9 صباحاً", cron: "0 9 1 * *", type: "monthly" as ScheduleType },
    { label: "كل سنة في 1 يناير 9 صباحاً", cron: "0 9 1 1 *", type: "yearly" as ScheduleType },
  ]

  const handlePresetSelect = (preset: typeof presets[0]) => {
    onChange(preset.cron)
    // Parse and set state
    const parsed = parseCronExpression(preset.cron)
    if (parsed) {
      setScheduleType(parsed.type)
      setHour(parsed.hour)
      setMinute(parsed.minute)
      if (parsed.days) setSelectedDays(parsed.days)
      if (parsed.dayOfMonth) setDayOfMonth(parsed.dayOfMonth)
      if (parsed.month) setMonth(parsed.month)
    }
  }

  return (
    <div className="space-y-4">
      {label && (
        <div className="space-y-2">
          <Label>{label}</Label>
          <p className="text-xs text-muted-foreground">
            اترك الحقل فارغاً للإرسال مرة واحدة فقط.
          </p>
        </div>
      )}

      {/* Preset Options */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">اختيارات سريعة:</Label>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset, idx) => (
            <Button
              key={idx}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePresetSelect(preset)}
              className="text-xs"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <RadioGroup
        value={scheduleType}
        onValueChange={(value) => setScheduleType(value as ScheduleType)}
        className="flex flex-wrap gap-4"
      >
        <div className="flex items-center space-x-2 space-x-reverse">
          <RadioGroupItem value="daily" id="daily" />
          <Label htmlFor="daily" className="cursor-pointer">يومي</Label>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <RadioGroupItem value="weekly" id="weekly" />
          <Label htmlFor="weekly" className="cursor-pointer">أسبوعي</Label>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <RadioGroupItem value="monthly" id="monthly" />
          <Label htmlFor="monthly" className="cursor-pointer">شهري</Label>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <RadioGroupItem value="yearly" id="yearly" />
          <Label htmlFor="yearly" className="cursor-pointer">سنوي</Label>
        </div>
      </RadioGroup>

      {/* Time Picker */}
      <div className="flex items-center gap-4">
        <Label className="text-sm">الوقت:</Label>
        <div className="flex items-center gap-2">
          <Select
            value={hour.toString()}
            onValueChange={(value) => setHour(parseInt(value, 10))}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {i.toString().padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-lg">:</span>
          <Select
            value={minute.toString()}
            onValueChange={(value) => setMinute(parseInt(value, 10))}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 15, 30, 45].map(m => (
                <SelectItem key={m} value={m.toString()}>
                  {m.toString().padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Weekly Day Selection */}
      {scheduleType === "weekly" && (
        <div className="space-y-2">
          <Label className="text-sm">اختر الأيام:</Label>
          <div className="flex flex-wrap gap-2">
            {ENGLISH_DAYS.map((_, index) => (
              <Button
                key={index}
                type="button"
                variant={selectedDays.includes(index) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleDay(index)}
                className={cn(
                  "min-w-[80px]",
                  selectedDays.includes(index) && "bg-primary text-primary-foreground"
                )}
              >
                {ARABIC_DAYS[index]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Day Selection */}
      {scheduleType === "monthly" && (
        <div className="space-y-2">
          <Label className="text-sm">يوم من الشهر:</Label>
          <Select
            value={dayOfMonth.toString()}
            onValueChange={(value) => setDayOfMonth(parseInt(value, 10))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <SelectItem key={day} value={day.toString()}>
                  اليوم {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Yearly Selection */}
      {scheduleType === "yearly" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">الشهر:</Label>
            <Select
              value={month.toString()}
              onValueChange={(value) => setMonth(parseInt(value, 10))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()}>
                    {ARABIC_MONTHS[m - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">يوم من الشهر:</Label>
            <Select
              value={dayOfMonth.toString()}
              onValueChange={(value) => setDayOfMonth(parseInt(value, 10))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <SelectItem key={day} value={day.toString()}>
                    اليوم {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Cron Expression Preview */}
      {value && validateCronExpression(value) && (
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold">التعبير المُنشأ:</Label>
            <Badge variant="outline" className="font-mono text-xs">
              {value}
            </Badge>
          </div>
          
          {nextRuns.length > 0 && (
            <div className="space-y-1 mt-3">
              <Label className="text-xs text-muted-foreground">المواعيد القادمة:</Label>
              <ul className="text-xs space-y-1">
                {nextRuns.map((date, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {format(date, "PPP p", { locale: ar })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
