"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarIcon, Clock, AlertCircle, CheckCircle2, Lightbulb } from "lucide-react"
import { format, addDays, isSameDay, isWeekend, startOfToday } from "date-fns"
import { ar } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface SchedulePickerProps {
  value?: string // ISO datetime string or empty
  onChange: (datetime: string | null) => void
  label?: string
}

// Recommended times configuration
const RECOMMENDED_CONFIG = {
  bestHours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  avoidHours: [0, 1, 2, 3, 4, 5, 6, 7, 22, 23],
  bestDays: [1, 2, 3, 4, 5], // Monday-Friday
  avoidDays: [0, 6], // Sunday, Saturday
}

function isRecommendedTime(date: Date, hour: number): { isRecommended: boolean; reason?: string } {
  const dayOfWeek = date.getDay()
  
  // Check if weekend
  if (RECOMMENDED_CONFIG.avoidDays.includes(dayOfWeek)) {
    return { isRecommended: false, reason: "عطلة نهاية الأسبوع" }
  }
  
  // Check if avoid hours
  if (RECOMMENDED_CONFIG.avoidHours.includes(hour)) {
    return { isRecommended: false, reason: hour < 8 ? "وقت مبكر جداً" : "وقت متأخر جداً" }
  }
  
  // Check if best hours
  if (RECOMMENDED_CONFIG.bestHours.includes(hour)) {
    return { isRecommended: true }
  }
  
  // Neutral time (not best, but acceptable)
  return { isRecommended: true, reason: "وقت مقبول" }
}

export function SchedulePicker({ value = "", onChange, label = "وقت الإرسال" }: SchedulePickerProps) {
  const [isScheduled, setIsScheduled] = useState(!!value)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    value ? new Date(value) : undefined
  )
  const [selectedHour, setSelectedHour] = useState<number>(
    value ? new Date(value).getHours() : 9
  )
  const [selectedMinute, setSelectedMinute] = useState<number>(
    value ? new Date(value).getMinutes() : 0
  )

  // Update parent when schedule changes
  useEffect(() => {
    if (isScheduled && selectedDate) {
      const datetime = new Date(selectedDate)
      datetime.setHours(selectedHour, selectedMinute, 0, 0)
      
      // Ensure future date
      if (datetime > new Date()) {
        onChange(datetime.toISOString())
      }
    } else if (!isScheduled) {
      onChange(null)
    }
  }, [isScheduled, selectedDate, selectedHour, selectedMinute, onChange])

  // Parse existing value on mount
  useEffect(() => {
    if (value && value.trim() !== "") {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        setSelectedDate(date)
        setSelectedHour(date.getHours())
        setSelectedMinute(date.getMinutes())
        setIsScheduled(true)
      }
    }
  }, [value])

  // When enabling scheduling, set default to tomorrow at 9 AM
  const handleEnableScheduling = (checked: boolean) => {
    setIsScheduled(checked)
    if (checked && !selectedDate) {
      const tomorrow = addDays(startOfToday(), 1)
      setSelectedDate(tomorrow)
      setSelectedHour(9)
      setSelectedMinute(0)
    } else if (!checked) {
      onChange(null)
    }
  }

  const validation = selectedDate 
    ? isRecommendedTime(selectedDate, selectedHour)
    : { isRecommended: true }

  const selectedDateTime = selectedDate 
    ? (() => {
        const dt = new Date(selectedDate)
        dt.setHours(selectedHour, selectedMinute, 0, 0)
        return dt
      })()
    : null

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-base">{label}</Label>
        
        {/* Selectable Options - Send Now vs Schedule Later */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {/* Send Now Option */}
          <div 
            className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
              !isScheduled 
                ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-sm' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => {
              if (isScheduled) {
                handleEnableScheduling(false)
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (isScheduled) {
                  handleEnableScheduling(false)
                }
              }
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                !isScheduled ? 'border-primary' : 'border-muted-foreground'
              }`}>
                {!isScheduled && <div className="w-3 h-3 rounded-full bg-primary" />}
              </div>
              <span className="font-bold text-lg">إرسال فوري</span>
            </div>
            <p className="text-sm text-muted-foreground mr-9">
              سيتم بدء الحملة فور الانتهاء من الإعداد
            </p>
          </div>

          {/* Schedule Later Option */}
          <div 
            className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
              isScheduled 
                ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-sm' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => {
              if (!isScheduled) {
                handleEnableScheduling(true)
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (!isScheduled) {
                  handleEnableScheduling(true)
                }
              }
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                isScheduled ? 'border-primary' : 'border-muted-foreground'
              }`}>
                {isScheduled && <div className="w-3 h-3 rounded-full bg-primary" />}
              </div>
              <span className="font-bold text-lg">جدولة لوقت لاحق</span>
            </div>
            <p className="text-sm text-muted-foreground mr-9">
              اختر التاريخ والوقت للإرسال
            </p>
          </div>
        </div>
      </div>

      {/* Schedule Options (shown when enabled) */}
      {isScheduled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* Calendar */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              اختر التاريخ
            </Label>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                      const newDate = new Date(date)
                      newDate.setHours(selectedHour, selectedMinute, 0, 0)
                      // If selected date is in the past, move to tomorrow
                      if (newDate <= new Date()) {
                        const tomorrow = addDays(startOfToday(), 1)
                        setSelectedDate(tomorrow)
                      } else {
                        setSelectedDate(date)
                      }
                    }
                }}
                disabled={(date) => date < startOfToday()}
                className="rounded-lg border"
              />
            </div>
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              اختر الوقت
            </Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Select
                  value={selectedHour.toString()}
                  onValueChange={(val) => setSelectedHour(parseInt(val, 10))}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem 
                        key={i} 
                        value={i.toString()}
                        className={cn(
                          RECOMMENDED_CONFIG.bestHours.includes(i) && "bg-green-50 dark:bg-green-900/20",
                          RECOMMENDED_CONFIG.avoidHours.includes(i) && "bg-red-50 dark:bg-red-900/20"
                        )}
                      >
                        {i.toString().padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-lg font-medium">:</span>
                <Select
                  value={selectedMinute.toString()}
                  onValueChange={(val) => setSelectedMinute(parseInt(val, 10))}
                >
                  <SelectTrigger className="w-24">
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
          </div>

          {/* Selected DateTime Preview */}
          {selectedDateTime && selectedDateTime > new Date() && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">الوقت المحدد:</Label>
              </div>
              <p className="text-sm font-medium">
                {format(selectedDateTime, "EEEE، d MMMM yyyy 'في' p", { locale: ar })}
              </p>
            </div>
          )}

          {/* Validation Feedback */}
          {selectedDate && (
            <div className={cn(
              "p-3 rounded-lg border flex items-start gap-3",
              validation.isRecommended 
                ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30" 
                : "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/30"
            )}>
              {validation.isRecommended ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <p className={cn(
                  "text-sm font-medium mb-1",
                  validation.isRecommended ? "text-green-700 dark:text-green-300" : "text-yellow-700 dark:text-yellow-300"
                )}>
                  {validation.isRecommended ? "وقت مناسب" : "تحذير"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {validation.isRecommended 
                    ? "هذا الوقت مناسب للإرسال وسيساعد في تجنب الحظر"
                    : validation.reason || "هذا الوقت قد لا يكون مثالياً للإرسال"}
                </p>
              </div>
            </div>
          )}

          {/* Best Practices Hints */}
          <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    توصيات لتجنب الحظر
                  </Label>
                  <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
                    <li>أفضل الأوقات: من 9 صباحاً إلى 6 مساءً (ساعات العمل)</li>
                    <li>تجنب الإرسال: بعد 9 مساءً أو قبل 8 صباحاً</li>
                    <li>للرسائل التجارية: تجنب عطلات نهاية الأسبوع</li>
                    <li>نصيحة: الإرسال في ساعات العمل يزيد من معدل القراءة</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
