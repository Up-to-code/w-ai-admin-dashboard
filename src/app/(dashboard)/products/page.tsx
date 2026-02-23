"use client";

import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/mock/convex-api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bot, FolderTree, ShoppingBag } from "lucide-react";
import { SallaProductsTab } from "./_components/SallaProductsTab";
import { ManualProductList } from "./_components/ManualProductList";
import { CategoryList } from "./_components/CategoryList";
import { ProductsTabErrorBoundary } from "./_components/ProductsTabErrorBoundary";
import { useOptionalConvexQuery } from "@/hooks/useOptionalConvexQuery";
import { FeatureUnavailableBanner } from "@/components/FeatureUnavailableBanner";
import { toast } from "sonner";
import { toUserSafeConvexMessage } from "@/lib/convexErrors";

export default function ProductsPage() {
  const { activePhoneNumberId, activeWorkspace } = useWorkspace();
  const manualCatalogReady = process.env.NEXT_PUBLIC_MANUAL_CATALOG_ENABLED === "1";
  const effectivePhoneNumberId =
    activePhoneNumberId && activePhoneNumberId !== "__all__" ? activePhoneNumberId : undefined;

  const legacyConfig = useQuery(
    api.ai_config.getConfig,
    effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : {}
  );
  const configQuery = useOptionalConvexQuery<any>(
    (api as any).ai_config.getConfig,
    effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : "skip",
    true
  );
  const config = configQuery.data ?? legacyConfig;
  const setManualCatalogEnabled = useMutation((api as any).ai_config.setManualCatalogEnabled);

  const manualCatalogEnabled = useMemo(() => {
    if (!config) return true;
    return config.manualCatalogEnabled ?? true;
  }, [config]);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">المنتجات</h1>
            <p className="text-sm text-muted-foreground">
              إدارة منتجات سلة والمنتجات اليدوية مع التصنيفات لكل رقم واتساب.
            </p>
          </div>

          {manualCatalogReady && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="manual-catalog-toggle" className="text-sm">تفعيل كتالوج المنتجات اليدوية للـ AI (هذا الرقم)</Label>
              <Switch
                id="manual-catalog-toggle"
                checked={manualCatalogEnabled}
                disabled={!effectivePhoneNumberId || configQuery.unavailable}
                onCheckedChange={async (checked) => {
                  if (!effectivePhoneNumberId) return;
                  try {
                    await setManualCatalogEnabled({
                      phoneNumberId: effectivePhoneNumberId,
                      enabled: checked,
                    });
                  } catch (error) {
                    toast.error(
                      toUserSafeConvexMessage(
                        error,
                        "تعذر تحديث إعداد الكتالوج اليدوي.",
                        "ميزة تفعيل الكتالوج اليدوي غير متاحة على نسخة الخادم الحالية."
                      )
                    );
                  }
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
      {configQuery.unavailable && (
        <FeatureUnavailableBanner message="إعدادات الكتالوج اليدوي غير متاحة حالياً على نسخة Convex الحالية. بقية الصفحة تعمل بشكل طبيعي." />
      )}

      {!effectivePhoneNumberId ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Badge variant="outline">اختر رقمًا</Badge>
            <p className="text-muted-foreground">
              لعرض وإدارة المنتجات اليدوية والتصنيفات، اختر رقم واتساب محدد من أعلى الشريط الجانبي.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="salla" className="space-y-4">
          <TabsList className={`grid ${manualCatalogReady ? "grid-cols-3" : "grid-cols-1"} max-w-xl`}>
            <TabsTrigger value="salla" className="gap-2"><ShoppingBag className="h-4 w-4" /> منتجات سلة</TabsTrigger>
            {manualCatalogReady && (
              <TabsTrigger value="manual" className="gap-2"><ShoppingBag className="h-4 w-4" /> المنتجات اليدوية</TabsTrigger>
            )}
            {manualCatalogReady && (
              <TabsTrigger value="categories" className="gap-2"><FolderTree className="h-4 w-4" /> التصنيفات</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="salla">
            <ProductsTabErrorBoundary>
              <SallaProductsTab />
            </ProductsTabErrorBoundary>
          </TabsContent>

          {manualCatalogReady ? (
            <TabsContent value="manual">
              <ProductsTabErrorBoundary>
                <Card>
                  <CardContent className="p-4 pb-0">
                    <p className="text-sm text-muted-foreground mb-4">
                      الرقم الحالي: <span className="font-medium text-foreground" dir="ltr">{activeWorkspace?.phone || effectivePhoneNumberId}</span>
                    </p>
                    <ManualProductList phoneNumberId={effectivePhoneNumberId} />
                  </CardContent>
                </Card>
              </ProductsTabErrorBoundary>
            </TabsContent>
          ) : (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                تم تعطيل الكتالوج اليدوي مؤقتًا حتى تفعيل دوال Convex الجديدة.
                <span className="block mt-2" dir="ltr">
                  Set `NEXT_PUBLIC_MANUAL_CATALOG_ENABLED=1` after running `npx convex dev`/`npx convex deploy`.
                </span>
              </CardContent>
            </Card>
          )}

          {manualCatalogReady && (
            <TabsContent value="categories">
              <ProductsTabErrorBoundary>
                <Card>
                  <CardContent className="p-4">
                    <CategoryList phoneNumberId={effectivePhoneNumberId} />
                  </CardContent>
                </Card>
              </ProductsTabErrorBoundary>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
