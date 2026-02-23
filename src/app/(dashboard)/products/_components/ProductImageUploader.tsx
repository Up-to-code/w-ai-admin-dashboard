"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/mock/convex-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Trash2, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type ProductImageInput = {
  storageId?: string;
  url: string;
  alt?: string;
  order: number;
};

type ProductImageUploaderProps = {
  value: ProductImageInput[];
  onChange: (next: ProductImageInput[]) => void;
};

export function ProductImageUploader({ value, onChange }: ProductImageUploaderProps) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFile = useMutation(api.files.saveFile);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  const addImage = (img: Omit<ProductImageInput, "order">) => {
    onChange([
      ...value,
      {
        ...img,
        order: value.length,
      },
    ]);
  };

  const removeImage = (index: number) => {
    const next = value.filter((_, i) => i !== index).map((img, i) => ({ ...img, order: i }));
    onChange(next);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) {
        throw new Error(`Upload failed: ${result.status}`);
      }
      const body = await result.json();
      const storageId = body.storageId as string;

      const saved = await saveFile({
        storageId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        category: "product",
      });

      if (saved.url) {
        addImage({
          storageId,
          url: saved.url,
          alt: file.name,
        });
        return;
      }
      toast.error("تم رفع الملف لكن تعذر توليد رابط الصورة. حاول مرة أخرى.");
    } catch (error) {
      console.error("Image upload failed", error);
      toast.error("فشل رفع الصورة. حاول مرة أخرى.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Upload className="h-4 w-4 ml-2" />}
          رفع صورة
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await uploadFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="أو ألصق رابط الصورة"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!manualUrl.trim()) return;
            addImage({ url: manualUrl.trim() });
            setManualUrl("");
          }}
        >
          <ImagePlus className="h-4 w-4 ml-2" />
          إضافة
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {value.map((img, i) => (
          <div key={`${img.url}-${i}`} className="relative rounded-md border overflow-hidden bg-muted/20 aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt || `Product image ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              className="absolute top-1 right-1 p-1 rounded-full bg-background/90 border"
              onClick={() => removeImage(i)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
