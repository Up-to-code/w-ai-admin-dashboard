"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/mock/convex-api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Search, Plus, ArrowRight } from "lucide-react"
import { ExportButton } from "./ExportButton"
import { ImportButton } from "./ImportButton"

interface Props {
  searchQuery: string
  onSearchChange: (v: string) => void
  contacts?: any[]
}

export function CustomersHeader({ searchQuery, onSearchChange, contacts }: Props) {
  const createContact = useMutation(api.contacts.create)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newTags, setNewTags] = useState("")
  const [newStage, setNewStage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreate = async () => {
    if (!newName || !newPhone) return
    setIsSubmitting(true)
    try {
      const tags = newTags
        .split(",")
        .map(t => t.trim())
        .filter(Boolean)
      await createContact({
        name: newName,
        phone: newPhone,
        email: newEmail || undefined,
        tags,
        stage: newStage || undefined,
      })
      setIsAddOpen(false)
      setNewName("")
      setNewPhone("")
      setNewEmail("")
      setNewTags("")
      setNewStage("")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <ImportButton />
      <ExportButton data={contacts || []} />
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="بحث بالاسم أو رقم الهاتف"
          className="pr-10 w-[280px]"
        />
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة عميل
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>إضافة عميل جديد</DialogTitle>
            <DialogDescription>أدخل بيانات العميل الأساسية لإضافته إلى قائمة العملاء.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="الاسم" />
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="رقم الهاتف" />
            </div>
            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="البريد الإلكتروني (اختياري)" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="الوسوم (VIP, جديد)" />
              <Input value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="المرحلة (جديد, متواصل)" />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={isSubmitting || !newName || !newPhone} className="gap-2">
                حفظ
                <ArrowRight className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
