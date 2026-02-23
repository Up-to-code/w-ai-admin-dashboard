"use client"

import { useState, useRef } from "react"
import { useMutation } from "convex/react"
import { api } from "@/mock/convex-api"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, FileSpreadsheet } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import * as XLSX from "xlsx"
import { toast } from "sonner"

const DEFAULT_IMPORTED_NAME = "عميل بدون اسم"

type ImportContact = {
    name: string
    phone: string
    email?: string
    tags: string[]
    stage?: string
    nameWasCompleted: boolean
}

type BulkCreateSummary = {
    importedCount: number
    skippedDuplicateCount: number
    skippedInvalidCount: number
    completedNameCount: number
    totalProcessed: number
}

function toBulkCreateSummary(result: unknown, chunkSize: number): BulkCreateSummary {
    if (typeof result === "number") {
        return {
            importedCount: result,
            skippedDuplicateCount: 0,
            skippedInvalidCount: 0,
            completedNameCount: 0,
            totalProcessed: chunkSize,
        }
    }

    if (result && typeof result === "object") {
        const r = result as Partial<BulkCreateSummary>
        return {
            importedCount: r.importedCount ?? 0,
            skippedDuplicateCount: r.skippedDuplicateCount ?? 0,
            skippedInvalidCount: r.skippedInvalidCount ?? 0,
            completedNameCount: r.completedNameCount ?? 0,
            totalProcessed: r.totalProcessed ?? chunkSize,
        }
    }

    return {
        importedCount: 0,
        skippedDuplicateCount: 0,
        skippedInvalidCount: 0,
        completedNameCount: 0,
        totalProcessed: chunkSize,
    }
}

const NAME_HEADERS = new Set([
    "الاسم",
    "اسم",
    "name",
    "full name",
    "customer name",
    "client name",
].map(normalizeHeader))

const PHONE_HEADERS = new Set([
    "رقم الهاتف",
    "رقم الجوال",
    "الجوال",
    "الهاتف",
    "phone",
    "phone number",
    "number",
    "numbers",
    "mobile",
    "mobile number",
    "whatsapp",
    "whatsapp number",
].map(normalizeHeader))

const EMAIL_HEADERS = new Set([
    "البريد الإلكتروني",
    "البريد الالكتروني",
    "email",
    "e-mail",
].map(normalizeHeader))

const TAGS_HEADERS = new Set([
    "الوسوم",
    "الوسم",
    "tags",
    "tag",
    "labels",
].map(normalizeHeader))

const STAGE_HEADERS = new Set([
    "المرحلة",
    "stage",
    "status",
].map(normalizeHeader))

function toAsciiDigits(value: string) {
    return value
        .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
        .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
}

function normalizeHeader(header: string) {
    return toAsciiDigits(header)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[_-]+/g, " ")
}

function normalizePhone(value: unknown) {
    return toAsciiDigits(String(value ?? "")).replace(/\D/g, "")
}

function parseTags(value: unknown) {
    const source = String(value ?? "")
    return source
        .split(/[،,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
}

function getCellValue(row: Record<string, unknown>, allowedHeaders: Set<string>) {
    for (const [key, value] of Object.entries(row)) {
        if (allowedHeaders.has(normalizeHeader(key))) {
            return value
        }
    }
    return undefined
}

function getPhoneCandidate(row: Record<string, unknown>) {
    const explicitPhone = getCellValue(row, PHONE_HEADERS)
    if (String(explicitPhone ?? "").trim()) {
        return explicitPhone
    }

    // Fallback for one-column sheets where header may be unknown but values are phone numbers.
    const nonEmptyValues = Object.values(row).filter((value) => String(value ?? "").trim() !== "")
    if (nonEmptyValues.length === 1) {
        return nonEmptyValues[0]
    }

    return undefined
}

function parseImportRow(row: Record<string, unknown>, globalTags: string[]): ImportContact {
    const rawName = String(getCellValue(row, NAME_HEADERS) ?? "").trim()
    const phone = normalizePhone(getPhoneCandidate(row))
    const emailRaw = String(getCellValue(row, EMAIL_HEADERS) ?? "").trim()
    const stageRaw = String(getCellValue(row, STAGE_HEADERS) ?? "").trim()
    const rowTags = parseTags(getCellValue(row, TAGS_HEADERS))
    const mergedTags = Array.from(new Set([...rowTags, ...globalTags]))

    return {
        name: rawName || DEFAULT_IMPORTED_NAME,
        phone,
        email: emailRaw || undefined,
        tags: mergedTags,
        stage: stageRaw || undefined,
        nameWasCompleted: rawName.length === 0,
    }
}

function readFileAsArrayBuffer(file: File) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result)
                return
            }
            reject(new Error("Failed to read file as ArrayBuffer"))
        }
        reader.onerror = () => {
            reject(reader.error ?? new Error("File read failed"))
        }
        reader.readAsArrayBuffer(file)
    })
}

export function ImportButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [progress, setProgress] = useState(0)
    const [globalTags, setGlobalTags] = useState("")
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const bulkCreate = useMutation(api.contacts.bulkCreate)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedFile(file)
        }
    }

    const handleStartImport = async () => {
        if (!selectedFile) return

        setIsImporting(true)
        setProgress(10)

        try {
            const data = await readFileAsArrayBuffer(selectedFile)
            const workbook = XLSX.read(data, { type: "array" })
            const sheetName = workbook.SheetNames[0]
            const sheet = sheetName ? workbook.Sheets[sheetName] : undefined

            if (!sheet) {
                toast.error("تعذر قراءة الملف. تأكد من وجود ورقة بيانات.")
                return
            }

            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
            setProgress(30)

            const globalTagList = parseTags(globalTags)
            const contactsToImport: Array<Omit<ImportContact, "nameWasCompleted">> = []
            let skippedInvalidFromParser = 0
            let completedNameFromParser = 0

            for (const row of rows) {
                const parsed = parseImportRow(row, globalTagList)
                if (parsed.phone.length < 7 || parsed.phone.length > 15) {
                    skippedInvalidFromParser += 1
                    continue
                }
                if (parsed.nameWasCompleted) {
                    completedNameFromParser += 1
                }

                contactsToImport.push({
                    name: parsed.name,
                    phone: parsed.phone,
                    email: parsed.email,
                    tags: parsed.tags,
                    stage: parsed.stage,
                })
            }

            setProgress(50)

            if (contactsToImport.length === 0) {
                toast.error(
                    skippedInvalidFromParser > 0
                        ? `لم يتم العثور على صفوف صالحة. تم تخطي ${skippedInvalidFromParser} صف غير صالح.`
                        : "لم يتم العثور على بيانات صالحة في الملف"
                )
                return
            }

            const chunkSize = 50
            let importedCount = 0
            let skippedDuplicateCount = 0
            let skippedInvalidCount = 0
            let completedNameCount = 0
            let totalProcessed = 0

            for (let i = 0; i < contactsToImport.length; i += chunkSize) {
                const chunk = contactsToImport.slice(i, i + chunkSize)
                const rawResult = await bulkCreate({
                    contacts: chunk,
                })
                const result = toBulkCreateSummary(rawResult, chunk.length)

                importedCount += result.importedCount
                skippedDuplicateCount += result.skippedDuplicateCount
                skippedInvalidCount += result.skippedInvalidCount
                completedNameCount += result.completedNameCount
                totalProcessed += result.totalProcessed

                const processedRows = Math.min(i + chunk.length, contactsToImport.length)
                const currentProgress = Math.min(50 + Math.floor((processedRows / contactsToImport.length) * 50), 100)
                setProgress(currentProgress)
            }

            const totalInvalid = skippedInvalidFromParser + skippedInvalidCount
            const totalCompletedNames = completedNameFromParser + completedNameCount

            if (importedCount === 0) {
                toast.error(
                    `لم يتم استيراد أي عميل. المكرر: ${skippedDuplicateCount} | غير صالح: ${totalInvalid}`
                )
                return
            }

            toast.success(
                `تم الاستيراد: ${importedCount} | مكرر: ${skippedDuplicateCount} | غير صالح: ${totalInvalid} | أسماء مكتملة: ${totalCompletedNames} | إجمالي معالج: ${totalProcessed + skippedInvalidFromParser}`
            )

            setIsOpen(false)
            resetState()
        } catch (error) {
            console.error("Import error:", error)
            toast.error("حدث خطأ أثناء استيراد البيانات")
        } finally {
            setIsImporting(false)
        }
    }

    const resetState = () => {
        setSelectedFile(null)
        setGlobalTags("")
        setProgress(0)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    return (
        <Dialog open={isOpen} onOpenChange={(v) => {
            setIsOpen(v)
            if (!v) resetState()
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    استيراد Excel
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>استيراد عملاء من Excel</DialogTitle>
                    <DialogDescription>حمّل ملف العملاء وحدد الوسوم لإدخالهم دفعة واحدة.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    <div className="space-y-2">
                        <Label>اختر الملف (.xlsx, .xls, .csv)</Label>
                        <div
                            onClick={() => !isImporting && fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer ${selectedFile ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
                                } ${isImporting ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                disabled={isImporting}
                            />
                            {selectedFile ? (
                                <>
                                    <FileSpreadsheet className="h-10 w-10 text-primary" />
                                    <div className="text-center">
                                        <p className="text-sm font-medium">{selectedFile.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-10 w-10 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground text-center">
                                        اسحب الملف هنا أو انقر للاختيار
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="globalTags">وسوم إضافية لجميع العملاء</Label>
                        <Input
                            id="globalTags"
                            value={globalTags}
                            onChange={(e) => setGlobalTags(e.target.value)}
                            placeholder="مثال: حملة رمضان, 2024"
                            disabled={isImporting}
                        />
                        <p className="text-[10px] text-muted-foreground">افصل بين الوسوم بفاصلة (,)</p>
                    </div>

                    {isImporting && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs mb-1">
                                <span>جاري المعالجة...</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setIsOpen(false)}
                            disabled={isImporting}
                        >
                            إلغاء
                        </Button>
                        <Button
                            onClick={handleStartImport}
                            disabled={!selectedFile || isImporting}
                            className="gap-2 min-w-[120px]"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    جاري الاستيراد
                                </>
                            ) : (
                                "بدء الاستيراد"
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
