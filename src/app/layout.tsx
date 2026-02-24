import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthErrorBoundary } from "@/components/AuthErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "chatcb-UI - إدارة واتساب للأعمال",
  description: "لوحة تحكم شاملة لإدارة واجهة برمجة تطبيقات واتساب للأعمال",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body
        className={`${cairo.variable} antialiased font-sans`}
      >
        <ConvexClientProvider>
          <ErrorBoundary>
            <AuthErrorBoundary>
              <AuthProvider>
                <AuthGuard>{children}</AuthGuard>
              </AuthProvider>
            </AuthErrorBoundary>
          </ErrorBoundary>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
