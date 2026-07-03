import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/ToastContext";
import AuthGuard from "@/components/auth/AuthGuard";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "HomeLand Premium CRM",
  description: "Hệ thống quản lý căn hộ dịch vụ cao cấp",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ToastProvider>
              <AuthGuard>
                {children}
              </AuthGuard>
            </ToastProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
