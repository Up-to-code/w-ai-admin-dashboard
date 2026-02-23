"use client"

import { useMemo, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/mock/convex-api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users } from "lucide-react"
import { CustomersHeader } from "./_components/CustomersHeader"
import { TagFilter } from "./_components/TagFilter"
import { CustomersList } from "./_components/CustomersList"
import { useWorkspace } from "@/contexts/WorkspaceContext"

export default function CustomersPage() {
  const { activePhoneNumberId } = useWorkspace()
  
  // "__all__" or null = show all. Convex expects undefined, not null.
  const effectivePhoneNumberId =
    !activePhoneNumberId || activePhoneNumberId === "__all__" ? undefined : activePhoneNumberId

  const contacts = useQuery(api.contacts.list, { limit: 1000 })
  const chats = useQuery(api.chat.listChats, effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : {})

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const chatByPhone = useMemo(() => {
    const map = new Map<string, string>()
    ;(chats || []).forEach(c => {
      if (c.contactPhone) map.set(c.contactPhone, String(c._id))
    })
    return map
  }, [chats])

  const contactsForCurrentNumber = useMemo(() => contacts || [], [contacts])

  const uniqueTags = useMemo(() => {
    const set = new Set<string>()
    ;(contactsForCurrentNumber || []).forEach(c => (c.tags || []).forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [contactsForCurrentNumber])

  const filteredContacts = useMemo(() => {
    const list = contactsForCurrentNumber
    const bySearch = searchQuery.trim()
      ? list.filter(c =>
          (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.phone || "").includes(searchQuery)
        )
      : list
    const byTag = selectedTag ? bySearch.filter(c => (c.tags || []).includes(selectedTag)) : bySearch
    return byTag
  }, [contactsForCurrentNumber, searchQuery, selectedTag])

  return (
    <div className="space-y-6 m-16">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">العملاء</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            إدارة جهات الاتصال والوسوم وبدء المحادثات
          </p>
        </div>

        <CustomersHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} contacts={contacts} />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>قائمة العملاء</CardTitle>
          <CardDescription>
            {effectivePhoneNumberId
              ? `إجمالي جهات الاتصال: ${contactsForCurrentNumber.length}`
              : `إجمالي: ${contacts ? contacts.length : 0}`}
          </CardDescription>
          <TagFilter tags={uniqueTags} selected={selectedTag} onSelect={setSelectedTag} />
        </CardHeader>
        <CardContent>
          {!contacts ? (
            <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>
          ) : (
            <CustomersList contacts={filteredContacts} chatByPhone={chatByPhone} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
