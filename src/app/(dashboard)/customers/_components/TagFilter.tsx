 "use client"
 
 import { Badge } from "@/components/ui/badge"
 import { Tag } from "lucide-react"
 import { cn } from "@/lib/utils"
 
 interface Props {
   tags: string[]
   selected: string | null
   onSelect: (tag: string | null) => void
 }
 
 export function TagFilter({ tags, selected, onSelect }: Props) {
   if (!tags || tags.length === 0) return null
 
   return (
     <div className="flex flex-wrap gap-2 pt-2">
       <Badge
         variant={selected === null ? "default" : "outline"}
         className={cn("cursor-pointer", selected === null ? "bg-primary text-primary-foreground" : "")}
         onClick={() => onSelect(null)}
       >
         الكل
       </Badge>
       {tags.map(t => (
         <Badge
           key={t}
           variant={selected === t ? "default" : "outline"}
           className={cn("cursor-pointer", selected === t ? "bg-primary text-primary-foreground" : "")}
           onClick={() => onSelect(selected === t ? null : t)}
         >
           <Tag className="h-3 w-3 mr-1" />
           {t}
         </Badge>
       ))}
     </div>
   )
 }
