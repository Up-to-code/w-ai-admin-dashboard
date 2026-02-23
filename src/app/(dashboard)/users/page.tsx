"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/mock/convex-api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Users, Edit2, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Id } from "@/mock/dataModel"

type UserRole = "admin" | "agent" | "user"

const roleLabels: Record<UserRole, string> = {
  admin: "مدير",
  agent: "وكيل",
  user: "مستخدم",
}

const roleVariants: Record<UserRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  agent: "secondary",
  user: "outline",
}

export default function UsersPage() {
  const users = useQuery(api.users.list) || []
  const updateRole = useMutation(api.users.updateRole)
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleEdit = (user: any) => {
    setEditingUserId(user._id)
    setSelectedRole(user.role)
  }

  const handleCancel = () => {
    setEditingUserId(null)
    setSelectedRole(null)
  }

  const handleSave = async (userId: string) => {
    if (!selectedRole) return
    
    setIsSaving(true)
    try {
      await updateRole({
        userId: userId as Id<"users">,
        role: selectedRole,
      })
      toast.success("تم تحديث الدور بنجاح")
      setEditingUserId(null)
      setSelectedRole(null)
    } catch (error: any) {
      toast.error("فشل تحديث الدور: " + (error.message || "خطأ غير معروف"))
    } finally {
      setIsSaving(false)
    }
  }

  const getInitials = (name?: string, email?: string, phone?: string) => {
    if (name) {
      const parts = name.split(" ")
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    if (phone) {
      return phone.slice(-2)
    }
    return "م"
  }

  return (
    <div className="space-y-6 m-16">
      <div>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">إدارة المستخدمين</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          عرض وتعديل أدوار المستخدمين في النظام
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة المستخدمين</CardTitle>
          <CardDescription>
            إجمالي: {users.length} مستخدم
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              لا يوجد مستخدمين
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const isEditing = editingUserId === user._id
                const initials = getInitials(user.name, user.email, user.phone)
                
                return (
                  <div
                    key={user._id}
                    className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {user.name || user.email || user.phone || "بدون اسم"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {user.email && (
                            <p className="text-sm text-muted-foreground truncate">
                              {user.email}
                            </p>
                          )}
                          {user.phone && (
                            <p className="text-sm text-muted-foreground truncate">
                              {user.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isEditing ? (
                        <>
                          <Select
                            value={selectedRole || undefined}
                            onValueChange={(value) => setSelectedRole(value as UserRole)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">مدير</SelectItem>
                              <SelectItem value="agent">وكيل</SelectItem>
                              <SelectItem value="user">مستخدم</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => handleSave(user._id)}
                            disabled={isSaving}
                            className="gap-2"
                          >
                            <Save className="h-4 w-4" />
                            حفظ
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="gap-2"
                          >
                            <X className="h-4 w-4" />
                            إلغاء
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant={roleVariants[user.role]}>
                            {roleLabels[user.role]}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(user)}
                            className="gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            تعديل
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
