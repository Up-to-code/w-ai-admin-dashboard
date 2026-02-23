export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background" dir="ltr" lang="en">
      {children}
    </div>
  )
}
