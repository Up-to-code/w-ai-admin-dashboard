"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import * as XLSX from "xlsx"

interface Props {
    data: any[]
    filename?: string
}

export function ExportButton({ data, filename = "customers.xlsx" }: Props) {
    const handleExport = () => {
        // Format data for export
        const exportData = data.map(c => ({
            "الاسم": c.name,
            "رقم الهاتف": c.phone,
            "البريد الإلكتروني": c.email || "",
            "الوسوم": (c.tags || []).join(", "),
            "المرحلة": c.stage || "",
            "التاريخ": new Date(c.createdAt).toLocaleDateString("ar-SA")
        }))

        const worksheet = XLSX.utils.json_to_sheet(exportData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Customers")
        XLSX.writeFile(workbook, filename)
    }

    return (
        <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            تصدير Excel
        </Button>
    )
}
