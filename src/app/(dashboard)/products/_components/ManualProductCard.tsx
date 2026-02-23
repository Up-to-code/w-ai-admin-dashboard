"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";

export type ManualProductDoc = {
  _id: string;
  title: string;
  description: string;
  primaryImageUrl?: string;
  images: Array<{ url: string }>;
  categoryId?: string;
  categoryNameSnapshot?: string;
  aiAdvice?: string;
  isActive: boolean;
};

type Props = {
  product: ManualProductDoc;
  onEdit: () => void;
  onDelete: () => void;
};

export function ManualProductCard({ product, onEdit, onDelete }: Props) {
  const image = product.primaryImageUrl || product.images?.[0]?.url;

  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted/30">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">بدون صورة</div>
        )}
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold line-clamp-1">{product.title}</h3>
          {!product.isActive && <Badge variant="secondary">غير نشط</Badge>}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
        {product.categoryNameSnapshot && <Badge variant="outline">{product.categoryNameSnapshot}</Badge>}
        {product.aiAdvice && <p className="text-xs text-primary line-clamp-2">نصيحة AI: {product.aiAdvice}</p>}

        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 ml-1" />
            تعديل
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 ml-1" />
            حذف
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
