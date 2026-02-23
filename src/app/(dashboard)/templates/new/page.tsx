"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAction, useQuery, useMutation } from "convex/react"
import { api } from "@/mock/convex-api"
import { Id } from "@/mock/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
    ArrowRight,
    LayoutTemplate,
    FileText,
    Image as ImageIcon,
    Video,
    Type,
    MousePointerClick,
    Plus,
    X,
    CheckCircle2,
    Smartphone,
    Link2,
    Phone,
    AlertCircle,
    Copy,
    ShoppingBag,
    Layers,
    Upload,
    Loader2
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { ProductPicker } from "../../chat/_components/ProductPicker"
import { useWorkspace } from "@/contexts/WorkspaceContext"

interface CarouselCard {
    headerType: "IMAGE" | "VIDEO"
    headerHandle?: string // Meta Handle
    headerUrl?: string // Preview URL
    bodyText: string
    buttons: ButtonConfig[]
}

interface ProductCarouselCard {
    productId: string // Catalog product ID
    bodyText?: string // Optional custom body
    buttonType: "VIEW" | "URL"
    buttonUrl?: string // For URL buttons
}

interface ButtonConfig {
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE" | "CATALOG"
    text: string
    url?: string
    phone_number?: string
    example?: string // For COPY_CODE
}

export default function NewTemplatePage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const editName = searchParams?.get("edit")
    const fromStoreId = searchParams?.get("fromStore") as Id<"template_store"> | null
    const { activePhoneNumberId } = useWorkspace()
    const effectivePhoneNumberId =
      !activePhoneNumberId || activePhoneNumberId === "__all__" ? undefined : activePhoneNumberId

    const createTemplate = useAction(api.templates.createTemplate)
    const addToStore = useMutation(api.templateStore.add)
    const existingTemplate = useQuery(
        api.templates.getByName,
        editName ? { name: editName, phoneNumberId: effectivePhoneNumberId } : "skip"
    )
    const storeTemplate = useQuery(
        api.templateStore.get,
        fromStoreId ? { id: fromStoreId } : "skip"
    )
    const storeAppliedRef = useRef(false)
    const uploadTemplateMedia = useAction(api.whatsapp.uploadTemplateMedia)
    const uploadExternalMedia = useAction(api.whatsapp.uploadExternalTemplateMedia)
    const generateUploadUrl = useMutation(api.files.generateUploadUrl)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [uploadingMedia, setUploadingMedia] = useState(false)
    const [savingToStore, setSavingToStore] = useState(false)

    // Form State
    const [name, setName] = useState("")
    const [category, setCategory] = useState("MARKETING")
    const [language, setLanguage] = useState("ar")
    const [templateType, setTemplateType] = useState<"STANDARD" | "CAROUSEL" | "PRODUCT_CAROUSEL" | "CATALOG">("STANDARD")
    
    // Standard Components State
    const [headerType, setHeaderType] = useState<"NONE" | "TEXT" | "IMAGE" | "VIDEO">("NONE")
    const [headerText, setHeaderText] = useState("")
    const [headerHandle, setHeaderHandle] = useState("")
    const [headerPreviewUrl, setHeaderPreviewUrl] = useState("")
    
    const [bodyText, setBodyText] = useState("")
    const [footerText, setFooterText] = useState("")
    const [buttons, setButtons] = useState<ButtonConfig[]>([])

    // Carousel State
    const [carouselHeaderType, setCarouselHeaderType] = useState<"IMAGE" | "VIDEO">("IMAGE")
    const [carouselCards, setCarouselCards] = useState<CarouselCard[]>([
        { headerType: "IMAGE", bodyText: "", buttons: [{ type: "URL", text: "View Details", url: "https://example.com" }] },
        { headerType: "IMAGE", bodyText: "", buttons: [{ type: "URL", text: "View Details", url: "https://example.com" }] }
    ])

    // Product Carousel State
    const [productCarouselCards, setProductCarouselCards] = useState<ProductCarouselCard[]>([])
    const [catalogId, setCatalogId] = useState<string>("") // Meta Catalog ID

    // Catalog Template State
    const [catalogHeaderHandle, setCatalogHeaderHandle] = useState("")
    const [catalogHeaderPreviewUrl, setCatalogHeaderPreviewUrl] = useState("")
    const [catalogBodyText, setCatalogBodyText] = useState("")

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [activeUploadField, setActiveUploadField] = useState<"HEADER" | number | null>(null) // HEADER or Card Index

    // Pre-fill form if editing (skip when loading from store)
    useEffect(() => {
        if (fromStoreId || !existingTemplate || name) return
        setName(existingTemplate.name + "_copy")
        setCategory(existingTemplate.category)
        setLanguage(existingTemplate.language)
        const components = existingTemplate.components || []
        const carousel = components.find((c: any) => c.type === "CAROUSEL")
        if (carousel) {
            setTemplateType("CAROUSEL")
        } else {
            setTemplateType("STANDARD")
            const header = components.find((c: any) => c.type === "HEADER")
            if (header) {
                setHeaderType(header.format)
                if (header.format === "TEXT") setHeaderText(header.text || "")
            }
            const body = components.find((c: any) => c.type === "BODY")
            if (body) setBodyText(body.text || "")
            const footer = components.find((c: any) => c.type === "FOOTER")
            if (footer) setFooterText(footer.text || "")
            const btns = components.find((c: any) => c.type === "BUTTONS")
            if (btns && btns.buttons) {
                setButtons(btns.buttons.map((b: any) => ({
                    type: b.type,
                    text: b.text,
                    url: b.url,
                    phone_number: b.phone_number,
                    example: b.example
                })))
            }
        }
    }, [existingTemplate, fromStoreId, name])

    // Pre-fill from template store (Use template)
    useEffect(() => {
        if (!storeTemplate || storeAppliedRef.current) return
        storeAppliedRef.current = true
        setName(storeTemplate.name + "_copy")
        setCategory(storeTemplate.category)
        setLanguage(storeTemplate.language)
        const snap = storeTemplate.formSnapshot
        if (snap && typeof snap === "object") {
            const s = snap as Record<string, unknown>
            if (s.templateType === "STANDARD") {
                setTemplateType("STANDARD")
                if (typeof s.headerType === "string") setHeaderType(s.headerType as "NONE" | "TEXT" | "IMAGE" | "VIDEO")
                if (typeof s.bodyText === "string") setBodyText(s.bodyText)
                if (typeof s.footerText === "string") setFooterText(s.footerText)
                if (Array.isArray(s.buttons)) {
                    setButtons(s.buttons.map((b: any) => ({
                        type: b.type || "QUICK_REPLY",
                        text: b.text || "",
                        url: b.url,
                        phone_number: b.phone_number,
                        example: Array.isArray(b.example) ? b.example[0] : b.example
                    })))
                }
            }
        } else {
            const components = (storeTemplate.components || []) as { type: string; format?: string; text?: string; buttons?: any[] }[]
            setTemplateType("STANDARD")
            const header = components.find((c) => c.type === "HEADER")
            if (header) {
                setHeaderType((header.format as "TEXT" | "IMAGE" | "VIDEO") || "NONE")
                if (header.format === "TEXT" && header.text) setHeaderText(header.text)
            }
            const body = components.find((c) => c.type === "BODY")
            if (body?.text) setBodyText(body.text)
            const footer = components.find((c) => c.type === "FOOTER")
            if (footer?.text) setFooterText(footer.text)
            const btns = components.find((c) => c.type === "BUTTONS")
            if (btns?.buttons) {
                setButtons(btns.buttons.map((b: any) => ({
                    type: b.type,
                    text: b.text,
                    url: b.url,
                    phone_number: b.phone_number,
                    example: Array.isArray(b.example) ? b.example[0] : b.example
                })))
            }
        }
    }, [storeTemplate])

    // --- Media Upload Logic ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingMedia(true)
        try {
            // 1. Upload to Convex Storage first (to get a URL for the server to read)
            const postUrl = await generateUploadUrl()
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            })
            const { storageId } = await result.json()

            // 2. Upload to Meta via Server Action
            const handle = await uploadTemplateMedia({
                storageId,
                type: file.type,
                phoneNumberId: effectivePhoneNumberId,
            })

            const previewUrl = URL.createObjectURL(file)

            if (activeUploadField === "HEADER") {
                if (templateType === "CATALOG") {
                    setCatalogHeaderHandle(handle)
                    setCatalogHeaderPreviewUrl(previewUrl)
                } else {
                    setHeaderHandle(handle)
                    setHeaderPreviewUrl(previewUrl)
                }
            } else if (typeof activeUploadField === "number") {
                // Update Carousel Card
                const newCards = [...carouselCards]
                newCards[activeUploadField].headerHandle = handle
                newCards[activeUploadField].headerUrl = previewUrl
                setCarouselCards(newCards)
            }

        } catch (error) {
            console.error("Upload failed:", error)
            alert("فشل رفع الملف. تأكد من إعدادات Meta.")
        } finally {
            setUploadingMedia(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const triggerUpload = (field: "HEADER" | number) => {
        setActiveUploadField(field)
        fileInputRef.current?.click()
    }

    const handleSallaProductSelect = async (product: any, field: "HEADER" | number) => {
        if (!product.image) {
            alert("هذا المنتج لا يحتوي على صورة")
            return
        }

        setUploadingMedia(true)
        try {
            // 1. Update Preview Immediately
            if (field === "HEADER") {
                setHeaderType("IMAGE")
                setHeaderPreviewUrl(product.image)
                if (!bodyText) setBodyText(`${product.name}\n${product.price} ${product.currency}`)
            } else if (typeof field === "number") {
                if (carouselHeaderType !== "IMAGE") {
                     setCarouselHeaderType("IMAGE")
                     const newCards = carouselCards.map(c => ({ ...c, headerType: "IMAGE" as const }))
                     setCarouselCards(newCards)
                }
                
                const newCards = [...carouselCards]
                newCards[field].headerUrl = product.image
                newCards[field].bodyText = `${product.name}\n${product.price} ${product.currency}`
                setCarouselCards(newCards)
            }

            // 2. Upload to Meta (Backend handles fetch -> upload)
            const handle = await uploadExternalMedia({
                url: product.image,
                type: "image/jpeg", // Salla images are usually JPEGs/PNGs
                phoneNumberId: effectivePhoneNumberId,
            })

            // 3. Update Handle
            if (field === "HEADER") {
                setHeaderHandle(handle)
            } else if (typeof field === "number") {
                const newCards = [...carouselCards]
                newCards[field].headerHandle = handle
                // Re-update body/url just in case (though already done)
                newCards[field].headerUrl = product.image 
                newCards[field].bodyText = `${product.name}\n${product.price} ${product.currency}`
                
                // Add button if missing or update URL
                if (product.url) {
                    const hasUrlBtn = newCards[field].buttons.some(b => b.type === "URL")
                    if (!hasUrlBtn) {
                        // Check if we can add a button (limit 2 usually for mixed, or just 3)
                        if (newCards[field].buttons.length < 2) {
                             newCards[field].buttons.push({
                                 type: "URL",
                                 text: "عرض المنتج",
                                 url: product.url
                             })
                        }
                    } else {
                        // Update existing URL button? Maybe safer to leave user choice, 
                        // but let's try to update empty ones
                        newCards[field].buttons = newCards[field].buttons.map(b => 
                            b.type === "URL" && (!b.url || b.url === "https://example.com") 
                                ? { ...b, url: product.url, text: b.text === "View Details" ? "عرض المنتج" : b.text } 
                                : b
                        )
                    }
                }

                setCarouselCards(newCards)
            }

        } catch (error) {
            console.error("Salla import failed:", error)
            alert("فشل استيراد الصورة من سلة. " + String(error))
        } finally {
            setUploadingMedia(false)
        }
    }

    // --- Button Logic ---
    const handleAddButton = (type: ButtonConfig["type"], targetCards?: boolean, cardIndex?: number) => {
        if (targetCards) {
             // For Carousel: All cards must have same button structure
             // We update the schema for ALL cards
             const newCards = carouselCards.map(card => ({
                 ...card,
                 buttons: [...card.buttons, { type, text: "", url: "", phone_number: "" }]
             }))
             setCarouselCards(newCards)
        } else {
            if (buttons.length >= 3) return // Max 3 for standard mixed, max 10 for quick replies? Meta rules are complex.
            // Simplified: Max 3 general buttons
            setButtons([...buttons, { type, text: "", url: "", phone_number: "" }])
        }
    }

    const handleRemoveButton = (index: number, targetCards?: boolean) => {
        if (targetCards) {
            const newCards = carouselCards.map(card => ({
                ...card,
                buttons: card.buttons.filter((_, i) => i !== index)
            }))
            setCarouselCards(newCards)
        } else {
            setButtons(buttons.filter((_, i) => i !== index))
        }
    }

    const handleButtonChange = (index: number, field: string, value: string, targetCards?: boolean) => {
        if (targetCards) {
             // Updates validation/schema, but text might be unique per card? 
             // NO, Meta Carousel buttons must be SAME type, but text can be different?
             // Actually for Quick Replies yes. For URL/Phone, usually same type.
             // Meta Rule: "The buttons in each card must be the same type and in the same order."
             // "Button parameters (text, url, payload) can be different."
             // So we update ALL cards if it's type change. If text change, only that card?
             // To simplify UI: We will define the Button Structure globally for the carousel, 
             // and allow editing text per card.
             // WAIT: This is getting complex.
             // Let's implement: "Global Button Definition" for Carousel.
             // Actually, let's keep it simple: 
             // Update logic: if changing TYPE, change for all. If changing text, change for all (template default).
             // User can override text in specific card if needed? 
             // For now, let's assume buttons are identical across cards for simplicity, 
             // as most catalogs work that way.
             
             const newCards = carouselCards.map(card => {
                 const newBtns = [...card.buttons]
                 newBtns[index] = { ...newBtns[index], [field]: value }
                 return { ...card, buttons: newBtns }
             })
             setCarouselCards(newCards)
        } else {
            const newButtons = [...buttons]
            newButtons[index] = { ...newButtons[index], [field]: value }
            setButtons(newButtons)
        }
    }

    // --- Carousel Logic ---
    const handleCarouselTypeChange = (type: "IMAGE" | "VIDEO") => {
        setCarouselHeaderType(type)
        const newCards = carouselCards.map(card => ({ ...card, headerType: type }))
        setCarouselCards(newCards)
    }

    const addCard = () => {
        if (carouselCards.length >= 10) return
        // Copy structure of first card
        const templateCard = carouselCards[0]
        setCarouselCards([...carouselCards, { 
            headerType: carouselHeaderType, 
            bodyText: "", 
            buttons: templateCard.buttons.map(b => ({...b, text: b.text})) 
        }])
    }

    const removeCard = (index: number) => {
        if (carouselCards.length <= 1) return
        setCarouselCards(carouselCards.filter((_, i) => i !== index))
    }

    const updateCard = (index: number, field: keyof CarouselCard, value: any) => {
        const newCards = [...carouselCards]
        newCards[index] = { ...newCards[index], [field]: value }
        setCarouselCards(newCards)
    }


    const handleSubmit = async () => {
        if (!name) return
        
        setIsSubmitting(true)
        try {
            const components: any[] = []

            if (templateType === "STANDARD") {
                // Header
                if (headerType !== "NONE") {
                    components.push({
                        type: "HEADER",
                        format: headerType,
                        text: headerType === "TEXT" ? headerText : undefined,
                        example: (headerType === "IMAGE" || headerType === "VIDEO") && headerHandle ? {
                            header_handle: [headerHandle]
                        } : undefined
                    })
                }

                // Body
                components.push({ type: "BODY", text: bodyText })

                // Footer
                if (footerText) components.push({ type: "FOOTER", text: footerText })

                // Buttons
                if (buttons.length > 0) {
                    components.push({
                        type: "BUTTONS",
                        buttons: buttons.map(b => ({
                            type: b.type,
                            text: b.text,
                            url: b.type === "URL" ? b.url : undefined,
                            phone_number: b.type === "PHONE_NUMBER" ? b.phone_number : undefined,
                            example: b.type === "COPY_CODE" ? b.example : undefined
                        }))
                    })
                }
            } else if (templateType === "CAROUSEL") {
                // CAROUSEL
                components.push({ type: "BODY", text: bodyText || "Carousel Message" }) // Main body is required? Meta says "Body is required for the message bubble that contains the carousel"
                
                const cards = carouselCards.map(card => {
                    const cardComponents: any[] = [
                        {
                            type: "HEADER",
                            format: card.headerType,
                            example: card.headerHandle ? { header_handle: [card.headerHandle] } : undefined
                        },
                        { type: "BODY", text: card.bodyText }
                    ]

                    if (card.buttons.length > 0) {
                        cardComponents.push({
                            type: "BUTTONS",
                            buttons: card.buttons.map(b => ({
                                type: b.type,
                                text: b.text,
                                url: b.type === "URL" ? b.url : undefined,
                                phone_number: b.type === "PHONE_NUMBER" ? b.phone_number : undefined
                            }))
                        })
                    }

                    return {
                        components: cardComponents
                    }
                })

                components.push({
                    type: "CAROUSEL",
                    cards: cards
                })
            } else if (templateType === "PRODUCT_CAROUSEL") {
                // PRODUCT CAROUSEL
                if (!catalogId) {
                    alert("يجب تحديد معرف الكتالوج لقالب كاروسيل المنتجات")
                    setIsSubmitting(false)
                    return
                }
                if (productCarouselCards.length < 2 || productCarouselCards.length > 10) {
                    alert("يجب اختيار من 2 إلى 10 منتجات")
                    setIsSubmitting(false)
                    return
                }

                components.push({ type: "BODY", text: bodyText || "Product Carousel" })
                
                components.push({
                    type: "PRODUCT_CAROUSEL",
                    catalog_id: catalogId,
                    products: productCarouselCards.map(card => ({
                        product_retailer_id: card.productId,
                        body: card.bodyText,
                        button: {
                            type: card.buttonType,
                            url: card.buttonType === "URL" ? card.buttonUrl : undefined
                        }
                    }))
                })
            } else if (templateType === "CATALOG") {
                // CATALOG TEMPLATE
                if (!catalogId) {
                    alert("يجب تحديد معرف الكتالوج")
                    setIsSubmitting(false)
                    return
                }

                // Header (optional but recommended)
                if (catalogHeaderHandle) {
                    components.push({
                        type: "HEADER",
                        format: "IMAGE",
                        example: { header_handle: [catalogHeaderHandle] }
                    })
                }

                // Body
                components.push({ type: "BODY", text: catalogBodyText || "View our catalog" })

                // Footer (optional)
                if (footerText) components.push({ type: "FOOTER", text: footerText })

                // Catalog button (automatic)
                components.push({
                    type: "BUTTONS",
                    buttons: [{
                        type: "CATALOG",
                        text: "View Catalog"
                    }]
                })

                // Store catalog_id in component metadata
                components.push({
                    type: "CATALOG",
                    catalog_id: catalogId
                })
            }

            if (templateType === "CAROUSEL") {
                const invalidCardIndex = carouselCards.findIndex(c => c.buttons.length === 0)
                if (invalidCardIndex !== -1) {
                    alert(`البطاقة رقم ${invalidCardIndex + 1} يجب أن تحتوي على زر واحد على الأقل.`)
                    setIsSubmitting(false)
                    return
                }
            }

            if (templateType === "PRODUCT_CAROUSEL") {
                if (!catalogId) {
                    alert("يجب تحديد معرف الكتالوج لقالب كاروسيل المنتجات")
                    setIsSubmitting(false)
                    return
                }
                if (productCarouselCards.length < 2 || productCarouselCards.length > 10) {
                    alert("يجب اختيار من 2 إلى 10 منتجات")
                    setIsSubmitting(false)
                    return
                }
                const hasEmptyProduct = productCarouselCards.some(c => !c.productId)
                if (hasEmptyProduct) {
                    alert("جميع المنتجات يجب أن تحتوي على معرف المنتج")
                    setIsSubmitting(false)
                    return
                }
            }

            if (templateType === "CATALOG") {
                if (!catalogId) {
                    alert("يجب تحديد معرف الكتالوج")
                    setIsSubmitting(false)
                    return
                }
                if (!catalogBodyText.trim()) {
                    alert("يجب إدخال نص الرسالة")
                    setIsSubmitting(false)
                    return
                }
            }

            if (!effectivePhoneNumberId) {
                alert("اختر رقماً نشطاً من القائمة أعلاه لربط القالب به. التكاملات ← أضف رقم WhatsApp ورمز الوصول.")
                setIsSubmitting(false)
                return
            }

            await createTemplate({
                name: name.toLowerCase().replace(/\s+/g, '_'),
                category,
                language,
                components,
                phoneNumberId: effectivePhoneNumberId,
            })

            router.push("/templates?success=true")
        } catch (error) {
            console.error("Failed to create template:", error)
            const msg = error instanceof Error ? error.message : String(error)
            alert(msg.startsWith("فشل") || msg.startsWith("لا يمكن") ? msg : "فشل إنشاء القالب. " + msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSaveToStore = async () => {
        if (templateType !== "STANDARD" || !name.trim()) {
            alert("حفظ المتجر متاح للقوالب القياسية فقط. أدخل اسم القالب.")
            return
        }
        setSavingToStore(true)
        try {
            const components: any[] = []
            if (headerType !== "NONE") {
                components.push({
                    type: "HEADER",
                    format: headerType,
                    text: headerType === "TEXT" ? headerText : undefined,
                    example: (headerType === "IMAGE" || headerType === "VIDEO") && headerHandle ? { header_handle: [headerHandle] } : undefined
                })
            }
            components.push({ type: "BODY", text: bodyText })
            if (footerText) components.push({ type: "FOOTER", text: footerText })
            if (buttons.length > 0) {
                components.push({
                    type: "BUTTONS",
                    buttons: buttons.map((b) => ({
                        type: b.type,
                        text: b.text,
                        url: b.type === "URL" ? b.url : undefined,
                        phone_number: b.type === "PHONE_NUMBER" ? b.phone_number : undefined,
                        example: b.type === "COPY_CODE" ? b.example : undefined
                    }))
                })
            }
            const formSnapshot = {
                templateType: "STANDARD",
                headerType,
                bodyText,
                footerText,
                buttons: buttons.map((b) => ({ type: b.type, text: b.text, url: b.url, phone_number: b.phone_number, example: b.example }))
            }
            await addToStore({
                name: name.toLowerCase().replace(/\s+/g, "_"),
                language,
                category,
                components,
                formSnapshot
            })
            router.push("/templates/store?added=1")
        } catch (e) {
            console.error(e)
            alert("فشل حفظ القالب في المتجر. " + String(e))
        } finally {
            setSavingToStore(false)
        }
    }

    return (
        <div className="max-w-6xl mx-auto p-6 sm:p-8 animate-in fade-in duration-500">
            {/* Hidden File Input */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUpload} 
                accept="image/*,video/*"
            />

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="icon" onClick={() => router.push("/templates")} className="rounded-xl">
                    <ArrowRight className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{editName ? "نسخ وتعديل قالب" : "إنشاء قالب جديد"}</h1>
                    <p className="text-muted-foreground">صمم رسالة WhatsApp تفاعلية وجذابة</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Editor Column */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-6 space-y-8">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>اسم القالب (بالإنجليزي فقط)</Label>
                                    <Input 
                                        placeholder="مثال: welcome_message" 
                                        value={name} 
                                        onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                                        className="font-mono"
                                    />
                                    <p className="text-xs text-muted-foreground">يجب أن يكون فريداً، أحرف صغيرة وشرطة سفلية فقط.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>الفئة</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MARKETING">تسويق (Marketing)</SelectItem>
                                            <SelectItem value="UTILITY">خدمي (Utility)</SelectItem>
                                            <SelectItem value="AUTHENTICATION">توثيق (Auth)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>نوع القالب</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div 
                                            onClick={() => setTemplateType("STANDARD")}
                                            className={`border rounded-xl p-3 cursor-pointer transition-all flex items-center justify-center gap-2 ${templateType === 'STANDARD' ? 'border-primary bg-primary/5 text-primary font-bold' : 'hover:bg-muted'}`}
                                        >
                                            <FileText className="h-4 w-4" />
                                            قياسي
                                        </div>
                                        <div 
                                            onClick={() => setTemplateType("CAROUSEL")}
                                            className={`border rounded-xl p-3 cursor-pointer transition-all flex items-center justify-center gap-2 ${templateType === 'CAROUSEL' ? 'border-primary bg-primary/5 text-primary font-bold' : 'hover:bg-muted'}`}
                                        >
                                            <Layers className="h-4 w-4" />
                                            كاروسيل وسائط
                                        </div>
                                        <div 
                                            onClick={() => setTemplateType("PRODUCT_CAROUSEL")}
                                            className={`border rounded-xl p-3 cursor-pointer transition-all flex items-center justify-center gap-2 ${templateType === 'PRODUCT_CAROUSEL' ? 'border-primary bg-primary/5 text-primary font-bold' : 'hover:bg-muted'}`}
                                        >
                                            <ShoppingBag className="h-4 w-4" />
                                            كاروسيل منتجات
                                        </div>
                                        <div 
                                            onClick={() => setTemplateType("CATALOG")}
                                            className={`border rounded-xl p-3 cursor-pointer transition-all flex items-center justify-center gap-2 ${templateType === 'CATALOG' ? 'border-primary bg-primary/5 text-primary font-bold' : 'hover:bg-muted'}`}
                                        >
                                            <ShoppingBag className="h-4 w-4" />
                                            كتالوج
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {templateType === "STANDARD" ? (
                                // --- STANDARD EDITOR ---
                                <>
                                    {/* Header Section */}
                                    <div className="space-y-4">
                                        <Label className="flex items-center gap-2">
                                            <LayoutTemplate className="h-4 w-4" />
                                            رأس الرسالة (Header) <span className="text-muted-foreground font-normal text-xs">(اختياري)</span>
                                        </Label>
                                        <RadioGroup 
                                            value={headerType} 
                                            onValueChange={(v: any) => setHeaderType(v)}
                                            className="flex flex-wrap gap-4"
                                        >
                                            <div className={`flex items-center gap-2 border rounded-xl p-3 cursor-pointer transition-all ${headerType === 'NONE' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                                                <RadioGroupItem value="NONE" id="h-none" />
                                                <Label htmlFor="h-none" className="cursor-pointer">بدون</Label>
                                            </div>
                                            <div className={`flex items-center gap-2 border rounded-xl p-3 cursor-pointer transition-all ${headerType === 'TEXT' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                                                <RadioGroupItem value="TEXT" id="h-text" />
                                                <Label htmlFor="h-text" className="cursor-pointer flex items-center gap-2"><Type className="h-4 w-4" /> نص</Label>
                                            </div>
                                            <div className={`flex items-center gap-2 border rounded-xl p-3 cursor-pointer transition-all ${headerType === 'IMAGE' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                                                <RadioGroupItem value="IMAGE" id="h-image" />
                                                <Label htmlFor="h-image" className="cursor-pointer flex items-center gap-2"><ImageIcon className="h-4 w-4" /> صورة</Label>
                                            </div>
                                            <div className={`flex items-center gap-2 border rounded-xl p-3 cursor-pointer transition-all ${headerType === 'VIDEO' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                                                <RadioGroupItem value="VIDEO" id="h-video" />
                                                <Label htmlFor="h-video" className="cursor-pointer flex items-center gap-2"><Video className="h-4 w-4" /> فيديو</Label>
                                            </div>
                                        </RadioGroup>

                                        {headerType === "TEXT" && (
                                            <Input 
                                                placeholder="عنوان الرسالة..." 
                                                value={headerText} 
                                                onChange={e => setHeaderText(e.target.value)} 
                                                maxLength={60}
                                            />
                                        )}

                                        {(headerType === "IMAGE" || headerType === "VIDEO") && (
                                            <div className="flex gap-4 items-center border rounded-xl p-4 bg-muted/20">
                                                <div className="h-20 w-20 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                                                    {headerPreviewUrl ? (
                                                        <img src={headerPreviewUrl} className="h-full w-full object-cover" alt="Preview" />
                                                    ) : (
                                                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-sm mb-1">عينة الوسائط</h4>
                                                    <p className="text-xs text-muted-foreground mb-3">مطلوب من Meta لمراجعة القالب. لن يتم إرسالها للمستخدمين.</p>
                                                    <Button size="sm" variant="outline" onClick={() => triggerUpload("HEADER")} disabled={uploadingMedia}>
                                                        {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                                        رفع ملف
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Body Section */}
                                    <div className="space-y-4">
                                        <Label className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            نص الرسالة (Body) <span className="text-red-500">*</span>
                                        </Label>
                                        <Textarea 
                                            placeholder="اكتب محتوى رسالتك هنا... يمكنك استخدام المتغيرات مثل {{1}}"
                                            value={bodyText}
                                            onChange={e => setBodyText(e.target.value)}
                                            className="min-h-[120px] text-base"
                                        />
                                        <p className="text-xs text-muted-foreground">استخدم {"{{1}}"}, {"{{2}}"} لإضافة متغيرات ديناميكية.</p>
                                    </div>

                                    {/* Footer Section */}
                                    <div className="space-y-4">
                                        <Label className="flex items-center gap-2">
                                            <LayoutTemplate className="h-4 w-4 rotate-180" />
                                            تذييل (Footer) <span className="text-muted-foreground font-normal text-xs">(اختياري)</span>
                                        </Label>
                                        <Input 
                                            placeholder="نص صغير أسفل الرسالة..." 
                                            value={footerText}
                                            onChange={e => setFooterText(e.target.value)}
                                            maxLength={60}
                                        />
                                    </div>

                                    {/* Buttons Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="flex items-center gap-2">
                                                <MousePointerClick className="h-4 w-4" />
                                                الأزرار (Buttons) <span className="text-muted-foreground font-normal text-xs">(اختياري، حد أقصى 3)</span>
                                            </Label>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm" className="gap-2" disabled={buttons.length >= 3}>
                                                        <Plus className="h-4 w-4" /> إضافة زر
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => handleAddButton("QUICK_REPLY")}>رد سريع</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleAddButton("URL")}>رابط</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleAddButton("PHONE_NUMBER")}>اتصال</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleAddButton("COPY_CODE")}>نسخ كود</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleAddButton("CATALOG")}>كاتالوج (منتجات)</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="space-y-3">
                                            {buttons.map((btn, idx) => (
                                                <div key={idx} className="flex flex-col gap-3 bg-muted/30 p-3 rounded-xl border animate-in slide-in-from-top-2">
                                                    <div className="flex gap-3">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border text-xs font-bold shrink-0">
                                                            {idx + 1}
                                                        </div>
                                                        <Select 
                                                            value={btn.type} 
                                                            onValueChange={(v: any) => handleButtonChange(idx, "type", v)}
                                                            disabled
                                                        >
                                                            <SelectTrigger className="w-[140px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="QUICK_REPLY">رد سريع</SelectItem>
                                                                <SelectItem value="URL">رابط</SelectItem>
                                                                <SelectItem value="PHONE_NUMBER">اتصال</SelectItem>
                                                                <SelectItem value="COPY_CODE">نسخ كود</SelectItem>
                                                                <SelectItem value="CATALOG">كاتالوج</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Input 
                                                            placeholder="نص الزر" 
                                                            value={btn.text} 
                                                            onChange={e => handleButtonChange(idx, "text", e.target.value)}
                                                            maxLength={25}
                                                        />
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveButton(idx)} className="text-muted-foreground hover:text-destructive">
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    {btn.type === "URL" && (
                                                        <Input 
                                                            placeholder="https://example.com" 
                                                            value={btn.url} 
                                                            onChange={e => handleButtonChange(idx, "url", e.target.value)}
                                                            className="ml-11"
                                                        />
                                                    )}
                                                    {btn.type === "PHONE_NUMBER" && (
                                                        <Input 
                                                            placeholder="+966..." 
                                                            value={btn.phone_number} 
                                                            onChange={e => handleButtonChange(idx, "phone_number", e.target.value)}
                                                            className="ml-11"
                                                        />
                                                    )}
                                                    {btn.type === "COPY_CODE" && (
                                                        <Input 
                                                            placeholder="مثال للكود: SAVE20" 
                                                            value={btn.example} 
                                                            onChange={e => handleButtonChange(idx, "example", e.target.value)}
                                                            className="ml-11"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                            {buttons.length === 0 && (
                                                <div className="text-center py-4 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
                                                    لا توجد أزرار مضافة
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : templateType === "CAROUSEL" ? (
                                // --- CAROUSEL EDITOR ---
                                <div className="space-y-8">
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-300">
                                        تتيح لك قوالب الكاروسيل إرسال حتى 10 بطاقات قابلة للتمرير. يجب أن تحتوي جميع البطاقات على نفس هيكل الأزرار ونوع الوسائط.
                                    </div>

                                    <div className="space-y-4">
                                        <Label>نوع الوسائط في البطاقات</Label>
                                        <RadioGroup 
                                            value={carouselHeaderType} 
                                            onValueChange={(v: "IMAGE" | "VIDEO") => handleCarouselTypeChange(v)}
                                            className="flex gap-4"
                                        >
                                            <div className={`flex items-center gap-2 border rounded-xl p-3 cursor-pointer transition-all ${carouselHeaderType === 'IMAGE' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                                                <RadioGroupItem value="IMAGE" id="c-image" />
                                                <Label htmlFor="c-image" className="cursor-pointer flex items-center gap-2"><ImageIcon className="h-4 w-4" /> صورة</Label>
                                            </div>
                                            <div className={`flex items-center gap-2 border rounded-xl p-3 cursor-pointer transition-all ${carouselHeaderType === 'VIDEO' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                                                <RadioGroupItem value="VIDEO" id="c-video" />
                                                <Label htmlFor="c-video" className="cursor-pointer flex items-center gap-2"><Video className="h-4 w-4" /> فيديو</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    {/* Main Body */}
                                    <div className="space-y-4">
                                        <Label>نص الرسالة الرئيسي (يظهر فوق الكاروسيل)</Label>
                                        <Textarea 
                                            placeholder="اكتب مقدمة للكاروسيل..."
                                            value={bodyText}
                                            onChange={e => setBodyText(e.target.value)}
                                            className="min-h-[80px]"
                                        />
                                    </div>

                                    {/* Cards Editor */}
                                    <div className="space-y-4">
                                        <Label className="flex items-center justify-between">
                                            <span>البطاقات ({carouselCards.length}/10)</span>
                                            <Button size="sm" variant="outline" onClick={addCard} disabled={carouselCards.length >= 10}>
                                                <Plus className="h-4 w-4 mr-2" /> إضافة بطاقة
                                            </Button>
                                        </Label>
                                        
                                        <Tabs defaultValue="card-0" className="w-full">
                                            <TabsList className="w-full justify-start overflow-x-auto h-auto p-2 bg-muted/50 rounded-xl gap-2">
                                                {carouselCards.map((_, i) => (
                                                    <TabsTrigger key={i} value={`card-${i}`} className="rounded-lg px-4 py-2">
                                                        بطاقة {i + 1}
                                                    </TabsTrigger>
                                                ))}
                                            </TabsList>
                                            
                                            {carouselCards.map((card, i) => (
                                                <TabsContent key={i} value={`card-${i}`} className="space-y-6 border rounded-xl p-4 mt-4 animate-in fade-in-50">
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="font-bold text-lg">محتوى البطاقة {i + 1}</h4>
                                                        {carouselCards.length > 1 && (
                                                            <Button size="sm" variant="destructive" onClick={() => removeCard(i)}>
                                                                <X className="h-4 w-4 mr-2" /> حذف البطاقة
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {/* Card Header Media */}
                                                    <div className="space-y-2">
                                                        <Label>صورة/فيديو البطاقة</Label>
                                                        <div className="flex gap-4 items-center border rounded-xl p-4 bg-muted/20">
                                                            <div className="h-24 w-24 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                                                                {card.headerUrl ? (
                                                                    <img src={card.headerUrl} className="h-full w-full object-cover" alt="Preview" />
                                                                ) : (
                                                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex gap-2 flex-wrap">
                                                                    <Button size="sm" variant="outline" onClick={() => triggerUpload(i)} disabled={uploadingMedia}>
                                                                        {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                                                        رفع
                                                                    </Button>
                                                                    <ProductPicker 
                                                                        onSelect={(p) => handleSallaProductSelect(p, i)}
                                                                        trigger={
                                                                            <Button size="sm" variant="outline" disabled={uploadingMedia} className="text-purple-600 border-purple-200 hover:bg-purple-50">
                                                                                <ShoppingBag className="h-4 w-4 mr-2" />
                                                                                سلة
                                                                            </Button>
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Card Body */}
                                                    <div className="space-y-2">
                                                        <Label>نص البطاقة</Label>
                                                        <Input 
                                                            value={card.bodyText} 
                                                            onChange={e => updateCard(i, "bodyText", e.target.value)}
                                                            placeholder="وصف المنتج أو العرض..."
                                                        />
                                                    </div>

                                                    {/* Card Buttons (Global for now in UI logic simplified) */}
                                                    <div className="space-y-2">
                                                        <Label>أزرار البطاقة (تنطبق على جميع البطاقات)</Label>
                                                        {card.buttons.map((btn, btnIdx) => (
                                                            <div key={btnIdx} className="flex gap-2 mb-2">
                                                                <Input value={btn.text} onChange={e => handleButtonChange(btnIdx, "text", e.target.value, true)} />
                                                                {btn.type === "URL" && <Input value={btn.url} onChange={e => handleButtonChange(btnIdx, "url", e.target.value, true)} placeholder="URL" />}
                                                                <Button size="icon" variant="ghost" onClick={() => handleRemoveButton(btnIdx, true)}><X className="h-4 w-4" /></Button>
                                                            </div>
                                                        ))}
                                                        {card.buttons.length < 2 && (
                                                             <div className="flex gap-2">
                                                                 <Button size="sm" variant="outline" onClick={() => handleAddButton("QUICK_REPLY", true)}>+ رد سريع</Button>
                                                                 <Button size="sm" variant="outline" onClick={() => handleAddButton("URL", true)}>+ رابط</Button>
                                                             </div>
                                                        )}
                                                    </div>
                                                </TabsContent>
                                            ))}
                                        </Tabs>
                                    </div>
                                </div>
                            ) : templateType === "PRODUCT_CAROUSEL" ? (
                                // --- PRODUCT CAROUSEL EDITOR ---
                                <div className="space-y-6">
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-300">
                                        قوالب كاروسيل المنتجات تتيح إرسال حتى 10 منتجات من كتالوجك. يجب أن تكون المنتجات مرتبطة بكتالوج Meta.
                                    </div>

                                    <div className="space-y-2">
                                        <Label>معرف الكتالوج (Catalog ID)</Label>
                                        <Input
                                            value={catalogId}
                                            onChange={(e) => setCatalogId(e.target.value)}
                                            placeholder="أدخل معرف الكتالوج من Meta"
                                            className="font-mono"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            يمكنك العثور على معرف الكتالوج من Meta Business Manager
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>نص الرسالة الرئيسي</Label>
                                        <Textarea
                                            value={bodyText}
                                            onChange={(e) => setBodyText(e.target.value)}
                                            placeholder="رسالة تظهر مع كاروسيل المنتجات"
                                            rows={3}
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label>المنتجات ({productCarouselCards.length}/10)</Label>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={() => {
                                                    // Open product picker modal
                                                    setProductCarouselCards([...productCarouselCards, { productId: "", buttonType: "VIEW" }])
                                                }}
                                                disabled={productCarouselCards.length >= 10}
                                            >
                                                <Plus className="h-4 w-4 mr-2" /> إضافة منتج
                                            </Button>
                                        </div>

                                        {productCarouselCards.length === 0 ? (
                                            <div className="border-2 border-dashed rounded-xl p-8 text-center">
                                                <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                                <p className="text-muted-foreground">لا توجد منتجات محددة</p>
                                                <p className="text-xs text-muted-foreground mt-2">اختر من 2 إلى 10 منتجات لعرضها</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {productCarouselCards.map((card, idx) => (
                                                    <Card key={idx} className="p-4">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1 space-y-3">
                                                                <div className="space-y-2">
                                                                    <Label>معرف المنتج (Product Retailer ID)</Label>
                                                                    <Input
                                                                        value={card.productId}
                                                                        onChange={(e) => {
                                                                            const newCards = [...productCarouselCards]
                                                                            newCards[idx].productId = e.target.value
                                                                            setProductCarouselCards(newCards)
                                                                        }}
                                                                        placeholder="مثال: PROD-123"
                                                                        className="font-mono"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>نص إضافي (اختياري)</Label>
                                                                    <Textarea
                                                                        value={card.bodyText || ""}
                                                                        onChange={(e) => {
                                                                            const newCards = [...productCarouselCards]
                                                                            newCards[idx].bodyText = e.target.value
                                                                            setProductCarouselCards(newCards)
                                                                        }}
                                                                        placeholder="نص مخصص للمنتج"
                                                                        rows={2}
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>نوع الزر</Label>
                                                                    <Select
                                                                        value={card.buttonType}
                                                                        onValueChange={(value: "VIEW" | "URL") => {
                                                                            const newCards = [...productCarouselCards]
                                                                            newCards[idx].buttonType = value
                                                                            setProductCarouselCards(newCards)
                                                                        }}
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="VIEW">عرض (في التطبيق)</SelectItem>
                                                                            <SelectItem value="URL">رابط خارجي</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    {card.buttonType === "URL" && (
                                                                        <Input
                                                                            value={card.buttonUrl || ""}
                                                                            onChange={(e) => {
                                                                                const newCards = [...productCarouselCards]
                                                                                newCards[idx].buttonUrl = e.target.value
                                                                                setProductCarouselCards(newCards)
                                                                            }}
                                                                            placeholder="https://example.com/product"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {productCarouselCards.length > 1 && (
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    onClick={() => {
                                                                        setProductCarouselCards(productCarouselCards.filter((_, i) => i !== idx))
                                                                    }}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : templateType === "CATALOG" ? (
                                // --- CATALOG TEMPLATE EDITOR ---
                                <div className="space-y-6">
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-300">
                                        قوالب الكتالوج تعرض كتالوج المنتجات الكامل. يتطلب معرف كتالوج من Meta.
                                    </div>

                                    <div className="space-y-2">
                                        <Label>معرف الكتالوج (Catalog ID) *</Label>
                                        <Input
                                            value={catalogId}
                                            onChange={(e) => setCatalogId(e.target.value)}
                                            placeholder="أدخل معرف الكتالوج من Meta"
                                            className="font-mono"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            يمكنك العثور على معرف الكتالوج من Meta Business Manager
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>صورة الرأس (اختياري)</Label>
                                        <div className="flex items-center gap-4">
                                            {catalogHeaderPreviewUrl ? (
                                                <div className="relative">
                                                    <img src={catalogHeaderPreviewUrl} alt="Header" className="w-32 h-32 object-cover rounded-lg" />
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="absolute top-0 right-0"
                                                        onClick={() => {
                                                            setCatalogHeaderHandle("")
                                                            setCatalogHeaderPreviewUrl("")
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setActiveUploadField("HEADER")
                                                        fileInputRef.current?.click()
                                                    }}
                                                    disabled={uploadingMedia}
                                                >
                                                    {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                                    رفع صورة
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>نص الرسالة *</Label>
                                        <Textarea
                                            value={catalogBodyText}
                                            onChange={(e) => setCatalogBodyText(e.target.value)}
                                            placeholder="رسالة تظهر مع زر عرض الكتالوج"
                                            rows={4}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>نص التذييل (اختياري)</Label>
                                        <Input
                                            value={footerText}
                                            onChange={(e) => setFooterText(e.target.value)}
                                            placeholder="نص تذييل الرسالة"
                                        />
                                    </div>

                                    <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl text-sm text-green-800 dark:text-green-300">
                                        سيتم إضافة زر "عرض الكتالوج" تلقائياً عند إنشاء القالب
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4 flex-wrap">
                        <Button variant="outline" onClick={() => router.push("/templates")}>إلغاء</Button>
                        {templateType === "STANDARD" && (
                            <Button
                                variant="outline"
                                onClick={handleSaveToStore}
                                disabled={savingToStore || !name || !bodyText}
                            >
                                {savingToStore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                حفظ في المتجر
                            </Button>
                        )}
                        <Button 
                            onClick={handleSubmit} 
                            className="bg-[#004D3D] hover:bg-[#003D2D] min-w-[150px]"
                            disabled={
                                isSubmitting || 
                                !name || 
                                (templateType === "STANDARD" && !bodyText) ||
                                (templateType === "CAROUSEL" && !bodyText) ||
                                (templateType === "PRODUCT_CAROUSEL" && (!catalogId || productCarouselCards.length < 2)) ||
                                (templateType === "CATALOG" && (!catalogId || !catalogBodyText))
                            }
                        >
                            {isSubmitting ? "جاري الإرسال..." : "إرسال للمراجعة"}
                        </Button>
                    </div>
                </div>

                {/* Preview Column */}
                <div className="lg:col-span-4">
                    <div className="sticky top-8">
                        <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-900 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-2xl flex flex-col">
                            {/* ... (Same frame elements) ... */}
                            <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute z-20"></div>
                            
                            {/* WhatsApp Header */}
                            <div className="bg-[#008069] dark:bg-[#202c33] p-3 pt-8 flex items-center gap-2 text-white z-10 rounded-t-[2rem]">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <Smartphone className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-semibold">معاينة مباشرة</div>
                                </div>
                            </div>
                            
                            {/* Message Area */}
                            <div className="flex-1 p-3 overflow-y-auto bg-[#E5DDD5] dark:bg-[#111b21] bg-opacity-90 relative rounded-b-[2rem] flex flex-col">
                                {templateType === "STANDARD" ? (
                                    <div className="bg-white dark:bg-[#202c33] p-2 rounded-lg rounded-tl-none shadow-sm max-w-[90%] mb-2">
                                        {/* Standard Preview */}
                                        {headerType !== "NONE" && (
                                            <div className="mb-2">
                                                {headerType === "TEXT" && <p className="font-bold text-sm">{headerText || "عنوان الرسالة"}</p>}
                                                {(headerType === "IMAGE" || headerType === "VIDEO") && (
                                                    <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-32 flex items-center justify-center overflow-hidden">
                                                        {headerPreviewUrl ? (
                                                            <img src={headerPreviewUrl} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <p className="text-sm whitespace-pre-wrap">{bodyText || "نص الرسالة..."}</p>
                                        {footerText && <p className="text-[10px] text-gray-500 mt-2">{footerText}</p>}
                                        
                                        {/* Standard Buttons */}
                                        <div className="border-t mt-2 pt-2 space-y-1">
                                            {buttons.map((btn, i) => (
                                                <div key={i} className="text-center text-sm text-[#00a884] font-medium py-1">{btn.text || "زر"}</div>
                                            ))}
                                        </div>
                                    </div>
                                ) : templateType === "CAROUSEL" ? (
                                    <div className="space-y-2">
                                        <div className="bg-white dark:bg-[#202c33] p-2 rounded-lg rounded-tl-none shadow-sm max-w-[90%]">
                                            <p className="text-sm whitespace-pre-wrap">{bodyText || "مقدمة الكاروسيل..."}</p>
                                        </div>
                                        {/* Carousel Cards Preview (Horizontal Scroll) */}
                                        <div className="flex overflow-x-auto gap-2 pb-2 -mx-3 px-3">
                                            {carouselCards.map((card, i) => (
                                                <div key={i} className="bg-white dark:bg-[#202c33] rounded-lg shadow-sm min-w-[200px] max-w-[200px] overflow-hidden shrink-0">
                                                    <div className="h-24 bg-gray-200 flex items-center justify-center overflow-hidden">
                                                         {card.headerUrl ? <img src={card.headerUrl} className="w-full h-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                                                    </div>
                                                    <div className="p-2">
                                                        <p className="text-sm font-medium">{card.bodyText || "وصف البطاقة..."}</p>
                                                        <div className="mt-2 space-y-1">
                                                            {card.buttons.map((btn, bI) => (
                                                                <div key={bI} className="bg-gray-50 p-1 text-center text-xs text-[#00a884] rounded border">{btn.text || "زر"}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : templateType === "PRODUCT_CAROUSEL" ? (
                                    <div className="space-y-2">
                                        <div className="bg-white dark:bg-[#202c33] p-2 rounded-lg rounded-tl-none shadow-sm max-w-[90%]">
                                            <p className="text-sm whitespace-pre-wrap">{bodyText || "رسالة المنتجات..."}</p>
                                        </div>
                                        {/* Product Carousel Preview */}
                                        <div className="flex overflow-x-auto gap-2 pb-2 -mx-3 px-3">
                                            {productCarouselCards.length > 0 ? (
                                                productCarouselCards.map((card, i) => (
                                                    <div key={i} className="bg-white dark:bg-[#202c33] rounded-lg shadow-sm min-w-[200px] max-w-[200px] overflow-hidden shrink-0">
                                                        <div className="h-24 bg-gray-200 flex items-center justify-center">
                                                            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                                                        </div>
                                                        <div className="p-2">
                                                            <p className="text-xs text-muted-foreground font-mono">{card.productId || "Product ID"}</p>
                                                            {card.bodyText && (
                                                                <p className="text-sm mt-1">{card.bodyText}</p>
                                                            )}
                                                            <div className="mt-2">
                                                                <div className="bg-gray-50 p-1 text-center text-xs text-[#00a884] rounded border">
                                                                    {card.buttonType === "VIEW" ? "عرض" : "رابط"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center text-muted-foreground text-sm p-4">
                                                    اختر المنتجات للمعاينة
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : templateType === "CATALOG" ? (
                                    <div className="bg-white dark:bg-[#202c33] p-2 rounded-lg rounded-tl-none shadow-sm max-w-[90%] mb-2">
                                        {catalogHeaderPreviewUrl && (
                                            <div className="mb-2">
                                                <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-32 flex items-center justify-center overflow-hidden">
                                                    <img src={catalogHeaderPreviewUrl} className="w-full h-full object-cover" />
                                                </div>
                                            </div>
                                        )}
                                        <p className="text-sm whitespace-pre-wrap">{catalogBodyText || "عرض كتالوجنا..."}</p>
                                        {footerText && <p className="text-[10px] text-gray-500 mt-2">{footerText}</p>}
                                        <div className="border-t mt-2 pt-2">
                                            <div className="text-center text-sm text-[#00a884] font-medium py-1">عرض الكتالوج</div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
