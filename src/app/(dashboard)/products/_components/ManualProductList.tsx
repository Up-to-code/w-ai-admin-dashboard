"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/mock/convex-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ManualProductCard, type ManualProductDoc } from "./ManualProductCard";
import { ManualProductFormDialog } from "./ManualProductFormDialog";
import { useOptionalConvexQuery } from "@/hooks/useOptionalConvexQuery";
import { FeatureUnavailableBanner } from "@/components/FeatureUnavailableBanner";
import { toast } from "sonner";
import { toUserSafeConvexMessage } from "@/lib/convexErrors";

type Props = {
  phoneNumberId: string;
};

export function ManualProductList({ phoneNumberId }: Props) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ManualProductDoc | null>(null);

  const categoriesQuery = useOptionalConvexQuery<any[]>(
    (api as any).manualCatalog.listCategories,
    {
      phoneNumberId,
      includeInactive: false,
    },
    true
  );
  const categories = categoriesQuery.data;

  const resultQuery = useOptionalConvexQuery<any>(
    (api as any).manualCatalog.listManualProducts,
    {
      phoneNumberId,
      search: search.trim() || undefined,
      categoryId: (categoryId || undefined) as any,
      page,
      pageSize: 12,
    },
    true
  );

  const result = resultQuery.data;
  const deleteProduct = useAction((api as any).manualCatalog.deleteManualProduct);
  const items = (result?.items || [])
    .slice()
    .sort((a: any, b: any) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  const onDelete = async (id: string) => {
    try {
      await deleteProduct({ id: id as any });
      toast.success("تم حذف المنتج");
    } catch (error) {
      toast.error(
        toUserSafeConvexMessage(
          error,
          "تعذر حذف المنتج.",
          "ميزة المنتجات اليدوية غير متاحة حالياً على نسخة الخادم الحالية."
        )
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex gap-2 flex-1">
          <Input placeholder="ابحث عن منتج" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">كل التصنيفات</option>
            {(categories || []).map((category: any) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <ManualProductFormDialog phoneNumberId={phoneNumberId} />
      </div>
      {(categoriesQuery.unavailable || resultQuery.unavailable) && (
        <FeatureUnavailableBanner message="قائمة المنتجات اليدوية غير متاحة حالياً على نسخة Convex الحالية. يمكنك متابعة بقية الصفحة." />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((product: any) => (
          <ManualProductCard
            key={product._id}
            product={product}
            onEdit={() => setEditing(product)}
            onDelete={() => void onDelete(product._id)}
          />
        ))}
      </div>

      {result && result.items.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد منتجات يدوية لهذا الرقم</CardContent>
        </Card>
      )}

      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {result.totalPages}</span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
            disabled={page >= result.totalPages}
          >
            التالي
          </Button>
        </div>
      )}

      {editing && (
        <ManualProductFormDialog
          phoneNumberId={phoneNumberId}
          product={editing}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={() => setEditing(null)}
        />
      )}
    </div>
  );
}
