"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/mock/convex-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { toUserSafeConvexMessage } from "@/lib/convexErrors";

export type CategoryDoc = {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
};

type Props = {
  phoneNumberId: string;
  category?: CategoryDoc | null;
  trigger?: React.ReactNode;
  onSaved?: () => void;
};

export function CategoryFormDialog({ phoneNumberId, category, trigger, onSaved }: Props) {
  const createCategory = useMutation((api as any).manualCatalog.createCategory);
  const updateCategory = useMutation((api as any).manualCatalog.updateCategory);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name || "");
    setDescription(category?.description || "");
  }, [open, category]);

  const submit = async () => {
    setSaving(true);
    try {
      if (category?._id) {
        await updateCategory({
          categoryId: category._id as any,
          name,
          description,
        });
      } else {
        await createCategory({ phoneNumberId, name, description });
      }
      setOpen(false);
      onSaved?.();
      toast.success(category ? "تم تحديث التصنيف" : "تم إنشاء التصنيف");
    } catch (error) {
      toast.error(
        toUserSafeConvexMessage(
          error,
          "تعذر حفظ التصنيف.",
          "ميزة التصنيفات اليدوية غير متاحة حالياً على نسخة الخادم الحالية."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 ml-2" />
            تصنيف جديد
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "تعديل التصنيف" : "إنشاء تصنيف"}</DialogTitle>
          <DialogDescription>أدخل اسم ووصف التصنيف ليظهر في الكتالوج اليدوي لهذا الرقم.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="اسم التصنيف" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea
            placeholder="وصف مختصر للتصنيف"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button className="w-full" onClick={submit} disabled={saving || name.trim().length < 2}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
