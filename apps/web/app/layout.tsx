import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/ToastContext";
import AuthGuard from "@/components/auth/AuthGuard";
import ProductionSecurityProvider from "@/components/security/ProductionSecurityProvider";
import Providers from "./providers";

export const metadata: Metadata = {
  title: {
    default: "HomeLand Premium CRM",
    template: "%s | HomeLand Premium CRM",
  },
  description: "HomeLand - Nền tảng quản lý vận hành tòa nhà & tài chính bất động sản thông minh",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <ProductionSecurityProvider>
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
        </ProductionSecurityProvider>
      </body>
    </html>
  );
}
