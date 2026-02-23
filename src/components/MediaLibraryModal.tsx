"use client"

import { useState, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/mock/convex-api"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Upload, File, Image as ImageIcon, Film, Music, CheckCircle2 } from "lucide-react"

interface MediaLibraryModalProps {
    children: React.ReactNode
    onSelect: (file: any) => void
    allowedTypes?: string[] // "image", "video", "audio", "application"
}

export function MediaLibraryModal({ children, onSelect, allowedTypes }: MediaLibraryModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [search, setSearch] = useState("")

    // Queries
    const files = useQuery(api.files.list, {})

    // Mutations
    const generateUploadUrl = useMutation(api.files.generateUploadUrl)
    const saveFile = useMutation(api.files.saveFile)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            // 1. Get URL
            const postUrl = await generateUploadUrl()

            // 2. POST to URL
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            })
            const { storageId } = await result.json()

            // 3. Save Metadata
            await saveFile({
                storageId,
                name: file.name,
                mimeType: file.type,
                size: file.size,
                category: file.type.startsWith("image") ? "image" :
                    file.type.startsWith("video") ? "video" :
                        file.type.startsWith("audio") ? "audio" : "document"
            })

            // Reset
            if (fileInputRef.current) fileInputRef.current.value = ""
        } catch (error) {
            console.error("Upload failed", error)
        } finally {
            setUploading(false)
        }
    }

    const filteredFiles = files?.filter(f => {
        if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (allowedTypes && allowedTypes.length > 0) {
            const type = f.mimeType.split('/')[0];
            // Simple mapping, can be improved
            return allowedTypes.some(t => f.mimeType.includes(t))
        }
        return true;
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-3xl h-[600px] flex flex-col p-0 gap-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>Média Library</DialogTitle>
                    <DialogDescription>اختر ملفاً من المكتبة أو ارفع ملفاً جديداً للاستخدام في الرسائل.</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="library" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 border-b flex items-center justify-between bg-muted/30">
                        <TabsList className="bg-transparent gap-4">
                            <TabsTrigger value="library" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-12 px-4">
                                مكتبة الملفات
                            </TabsTrigger>
                            <TabsTrigger value="upload" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-12 px-4">
                                رفع جديد
                            </TabsTrigger>
                        </TabsList>
                        <Input
                            placeholder="بحث..."
                            className="w-48 h-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <TabsContent value="library" className="flex-1 p-0 m-0 overflow-hidden">
                        <ScrollArea className="h-full p-4">
                            {!files ? (
                                <div className="flex items-center justify-center h-48">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredFiles?.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    لا توجد ملفات. قم برفع ملفات جديدة.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {filteredFiles?.map((file) => (
                                        <div
                                            key={file._id}
                                            className="group relative border rounded-lg cursor-pointer hover:border-primary transition-all overflow-hidden bg-background"
                                            onClick={() => {
                                                onSelect(file)
                                                setIsOpen(false)
                                            }}
                                        >
                                            <div className="aspect-square bg-muted/20 flex items-center justify-center">
                                                {file.mimeType.startsWith("image") ? (
                                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                                ) : file.mimeType.startsWith("video") ? (
                                                    <Film className="h-10 w-10 text-muted-foreground" />
                                                ) : file.mimeType.startsWith("audio") ? (
                                                    <Music className="h-10 w-10 text-muted-foreground" />
                                                ) : (
                                                    <File className="h-10 w-10 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="p-2 text-xs truncate font-medium">
                                                {file.name}
                                            </div>
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <CheckCircle2 className="h-5 w-5 text-primary fill-background" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="upload" className="flex-1 m-0 flex flex-col items-center justify-center gap-4 bg-muted/10">
                        <div
                            className={`border-2 border-dashed rounded-xl p-12 text-center hover:bg-muted/20 transition-all cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleUpload}
                                accept={allowedTypes?.map(t => `${t}/*`).join(',') || "*/*"}
                            />
                            {uploading ? (
                                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                            ) : (
                                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            )}
                            <h3 className="font-semibold text-lg">{uploading ? "جاري الرفع..." : "اضغط للرفع"}</h3>
                            <p className="text-muted-foreground text-sm mt-2">صور، فيديو، صوت، أو مستندات</p>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
