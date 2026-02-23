"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/mock/convex-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { ProductImageUploader, type ProductImageInput } from "./ProductImageUploader";
import type { ManualProductDoc } from "./ManualProductCard";
import { useOptionalConvexQuery } from "@/hooks/useOptionalConvexQuery";
import { FeatureUnavailableBanner } from "@/components/FeatureUnavailableBanner";
import { toast } from "sonner";
import { toUserSafeConvexMessage } from "@/lib/convexErrors";

type Props = {
  phoneNumberId: string;
  product?: ManualProductDoc | null;
  trigger?: React.ReactNode;
  onSaved?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ManualProductFormDialog({ phoneNumberId, product, trigger, onSaved, open: controlledOpen, onOpenChange }: Props) {
  const createProduct = useAction((api as any).manualCatalog.createManualProduct);
  const updateProduct = useAction((api as any).manualCatalog.updateManualProduct);
  const categoriesQuery = useOptionalConvexQuery<any[]>(
    (api as any).manualCatalog.listCategories,
    {
      phoneNumberId,
      includeInactive: false,
    },
    true
  );
  const categories = categoriesQuery.data;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState<ProductImageInput[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(product?.title || "");
    setDescription(product?.description || "");
    setCategoryId((product as any)?.categoryId || "");
    setImages(
      (product?.images || []).map((img: any, i: number) => ({
        storageId: img.storageId,
        url: img.url,
        alt: img.alt,
        order: i,
      }))
    );
  }, [open, product]);

  const submit = async () => {
    setSaving(true);
    try {
      if (product?._id) {
        await updateProduct({
          id: product._id as any,
          title,
          description,
          images,
          categoryId: (categoryId || undefined) as any,
        });
      } else {
        await createProduct({
          phoneNumberId,
          title,
          description,
          images,
          categoryId: (categoryId || undefined) as any,
        });
      }
      setOpen(false);
      onSaved?.();
      toast.success(product ? "تم تحديث المنتج" : "تم إنشاء المنتج");
    } catch (error) {
      toast.error(
        toUserSafeConvexMessage(
          error,
          "تعذر حفظ المنتج.",
          "ميزة حفظ المنتجات اليدوية غير متاحة حالياً على نسخة الخادم الحالية."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const valid = title.trim().length >= 2 && description.trim().length >= 10 && images.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {(trigger || !onOpenChange) && (
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              منتج جديد
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? "تعديل المنتج" : "إضافة منتج"}</DialogTitle>
          <DialogDescription>أضف صور المنتج والعنوان والوصف وربطه بتصنيف عند الحاجة.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {categoriesQuery.unavailable && (
            <FeatureUnavailableBanner message="تحميل التصنيفات غير متاح حالياً. يمكنك المتابعة بدون اختيار تصنيف." />
          )}
          <Input placeholder="عنوان المنتج" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="وصف المنتج"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[120px]"
          />

          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">تصنيف تلقائي بواسطة AI</option>
            {(categories || []).map((category: any) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>

          <ProductImageUploader value={images} onChange={setImages} />

          <Button className="w-full" onClick={submit} disabled={saving || !valid}>
            {saving ? "جاري الحفظ..." : "حفظ المنتج"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
