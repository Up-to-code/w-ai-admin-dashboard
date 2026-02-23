"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/mock/convex-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Save, RefreshCw, Send, Star, Plus, FlaskConical, Phone } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function AiSettingsPage() {
  const { activePhoneNumberId, activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  
  // Use activePhoneNumberId for strict per-number config.
  const effectivePhoneNumberId = activePhoneNumberId || undefined;
  
  const config = useQuery(api.ai_config.getConfig, effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : {});
  const updateConfig = useMutation(api.ai_config.updateConfig);
  const runTest = useAction(api.agent.runTest);
  const saveFeedback = useMutation(api.agent.saveFeedback);
  const feedbackStats = useQuery(api.agent.feedbackStats);
  const listKnowledge = useQuery(api.ai.listKnowledge);
  const saveKnowledge = useAction(api.ai.saveKnowledge);

  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState<number | undefined>(undefined);
  const [isActive, setIsActive] = useState(true);
  const [hasChanged, setHasChanged] = useState(false);

  const [testMessage, setTestMessage] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [lastTestInput, setLastTestInput] = useState("");
  const [lastTestOutput, setLastTestOutput] = useState("");

  const [rating, setRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);

  const [testAllResults, setTestAllResults] = useState<Array<{ message: string; response: string; error?: string }>>([]);
  const [isTestAllRunning, setIsTestAllRunning] = useState(false);

  const PRESET_TEST_MESSAGES = [
    { label: "تحية", message: "مرحبا" },
    { label: "سؤال سعر", message: "كم سعر الهاتف؟" },
    { label: "بحث عربي", message: "ابحث عن لابتوب" },
    { label: "بحث إنجليزي", message: "Show me laptops" },
    { label: "تحويل لموظف", message: "I want to speak to a human" },
  ];

  useEffect(() => {
    if (config) {
      setSystemPrompt(config.systemPrompt);
      setModel(config.model);
      setTemperature(config.temperature ?? undefined);
      setIsActive(config.isActive);
      setHasChanged(false);
    }
  }, [config]);

  const handleSave = async () => {
    try {
      await updateConfig({
        ...(effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : {}),
        systemPrompt,
        model,
        temperature: temperature ?? undefined,
        isActive,
      });
      setHasChanged(false);
      toast.success("تم الحفظ");
    } catch (e) {
      toast.error("فشل الحفظ");
      console.error(e);
    }
  };

  const handleTest = async () => {
    if (!testMessage.trim()) return;
    setIsTesting(true);
    setTestOutput("");
    setLastTestInput("");
    setLastTestOutput("");
    setRating(0);
    setFeedbackComment("");
    try {
      const response = await runTest({
        message: testMessage.trim(),
        systemPrompt,
        model,
        temperature: temperature ?? undefined,
      });
      setTestOutput(response);
      setLastTestInput(testMessage.trim());
      setLastTestOutput(response);
    } catch {
      toast.error("فشل الاتصال");
      setTestOutput("حدث خطأ. تحقق من الاتصال وحاول مرة أخرى.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestAll = async () => {
    setIsTestAllRunning(true);
    setTestAllResults([]);
    const results: Array<{ message: string; response: string; error?: string }> = [];
    for (const { label, message } of PRESET_TEST_MESSAGES) {
      try {
        const response = await runTest({
          message,
          systemPrompt,
          model,
          temperature: temperature ?? undefined,
        });
        results.push({ message: `[${label}] ${message}`, response });
      } catch (e) {
        const err = e instanceof Error ? e.message : "خطأ غير معروف";
        results.push({ message: `[${label}] ${message}`, response: "", error: err });
      }
      setTestAllResults([...results]);
    }
    setIsTestAllRunning(false);
    toast.success(results.every((r) => !r.error) ? "اكتملت كل التجارب" : "بعض التجارب فشلت");
  };

  const handleSubmitFeedback = async () => {
    if (rating < 1 || rating > 5) {
      toast.error("اختر من 1 إلى 5");
      return;
    }
    setFeedbackSubmitting(true);
    try {
      await saveFeedback({
        source: "test",
        rating,
        comment: feedbackComment.trim() || undefined,
        testInput: lastTestInput || undefined,
        testOutput: lastTestOutput || undefined,
      });
      toast.success("تم حفظ المراجعة");
      setRating(0);
      setFeedbackComment("");
    } catch {
      toast.error("فشل حفظ المراجعة");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleAddKnowledge = async () => {
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) {
      toast.error("أدخل العنوان والمحتوى");
      return;
    }
    setKnowledgeSaving(true);
    try {
      await saveKnowledge({ title: knowledgeTitle.trim(), content: knowledgeContent.trim() });
      toast.success("تمت الإضافة");
      setKnowledgeTitle("");
      setKnowledgeContent("");
      setKnowledgeOpen(false);
    } catch {
      toast.error("فشل الإضافة");
    } finally {
      setKnowledgeSaving(false);
    }
  };

  if (config === undefined || workspaceLoading) {
    return (
      <div className="p-8 flex items-center justify-center" dir="rtl">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      {/* شريط علوي */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Show which number's config is being edited */}
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {activeWorkspace ? (
                <>إعدادات: <strong className="text-foreground">{activeWorkspace.phone}</strong></>
              ) : effectivePhoneNumberId == null ? (
                <>إعدادات: <strong className="text-foreground">كل الأرقام (عام)</strong></>
              ) : (
                <>إعدادات: <strong className="text-foreground">رقم غير محدد</strong></>
              )}
            </span>
          </div>
          <span className="text-muted-foreground">|</span>
          <span className={isActive ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
            {isActive ? "المساعد نشط" : "المساعد متوقف"}
          </span>
          {feedbackStats && feedbackStats.count > 0 && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className="text-sm text-muted-foreground">
                متوسط التقييم: <strong className="text-foreground">{feedbackStats.average.toFixed(1)}</strong>
              </span>
              <span className="text-sm text-muted-foreground">
                عدد التجارب: <strong className="text-foreground">{feedbackStats.count}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {/* المنطقة الرئيسية — تجربة ومراجعة */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="اكتب رسالتك..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="flex-1 min-w-[200px]"
              disabled={isTesting || isTestAllRunning}
            />
            <Button onClick={handleTest} disabled={isTesting || isTestAllRunning || !testMessage.trim()}>
              {isTesting ? (
                <>
                  <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                  جاري الرد...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 ml-2" />
                  إرسال
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestAll}
              disabled={isTesting || isTestAllRunning}
            >
              {isTestAllRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                  جاري تجربة الكل...
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4 ml-2" />
                  تجربة الكل
                </>
              )}
            </Button>
          </div>

          {testOutput && !isTestAllRunning && testAllResults.length === 0 && (
            <div className="rounded-lg border-r-4 border-primary bg-muted/40 p-4">
              <p className="text-sm font-medium text-primary mb-2">رد المساعد</p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{testOutput}</p>
            </div>
          )}

          {testAllResults.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium text-primary">نتائج تجربة الكل</p>
              <ul className="space-y-3">
                {testAllResults.map((r, i) => (
                  <li key={i} className="text-sm border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <p className="font-medium text-muted-foreground mb-1">{r.message}</p>
                    {r.error ? (
                      <p className="text-destructive text-xs">{r.error}</p>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed bg-background/50 p-2 rounded">{r.response}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lastTestOutput && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm text-muted-foreground">كيف كان الرد؟</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={rating === n ? "default" : "outline"}
                    size="icon"
                    onClick={() => setRating(n)}
                  >
                    <Star className={`h-4 w-4 ${rating === n ? "fill-current" : ""}`} />
                    <span className="sr-only">{n}</span>
                  </Button>
                ))}
              </div>
              <Input
                placeholder="تعليقك"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="max-w-md"
              />
              <Button onClick={handleSubmitFeedback} disabled={feedbackSubmitting || rating < 1}>
                حفظ المراجعة
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* المنطقة الثانوية — تابات */}
      <Tabs defaultValue="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="settings">الإعدادات</TabsTrigger>
          <TabsTrigger value="knowledge">قاعدة المعرفة</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Textarea
                value={systemPrompt}
                onChange={(e) => {
                  setSystemPrompt(e.target.value);
                  setHasChanged(true);
                }}
                className="min-h-[160px] text-sm"
                placeholder="صف كيف تريد المساعد أن يتصرف مع العملاء..."
              />
              <Input
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setHasChanged(true);
                }}
                placeholder="معرف النموذج (اتركه افتراضي إن لم تعرف)"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">درجة الحرارة (٠–٢)</span>
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTemperature(v === "" ? undefined : parseFloat(v));
                    setHasChanged(true);
                  }}
                  className="w-20"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">تفعيل المساعد في المحادثات الحية</span>
                <Switch
                  checked={isActive}
                  onCheckedChange={(c) => {
                    setIsActive(c);
                    setHasChanged(true);
                  }}
                />
              </div>
              <Button onClick={handleSave} disabled={!hasChanged}>
                <Save className="h-4 w-4 ml-2" />
                حفظ
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Dialog open={knowledgeOpen} onOpenChange={setKnowledgeOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة مقطع
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة مقطع للمعرفة</DialogTitle>
                    <DialogDescription>أدخل عنواناً ومحتوى ليتم استخدامهما في إجابات المساعد.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <Input
                      placeholder="العنوان"
                      value={knowledgeTitle}
                      onChange={(e) => setKnowledgeTitle(e.target.value)}
                    />
                    <Textarea
                      placeholder="المحتوى"
                      value={knowledgeContent}
                      onChange={(e) => setKnowledgeContent(e.target.value)}
                      className="min-h-[120px]"
                    />
                    <Button onClick={handleAddKnowledge} disabled={knowledgeSaving}>
                      حفظ
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              {listKnowledge && listKnowledge.length > 0 ? (
                <ul className="space-y-2">
                  {listKnowledge.map((k) => (
                    <li key={k._id} className="text-sm p-3 rounded-lg border bg-muted/30">
                      <span className="font-medium">{k.title}</span>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{k.content}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد مقاطع. أضف مقاطع لتحسين إجابات المساعد.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
