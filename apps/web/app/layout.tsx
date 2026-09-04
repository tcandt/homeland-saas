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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var origOnError = window.onerror;
                window.onerror = function(msg, url, line, col, error) {
                  var m = String(msg || (error && error.message) || '');
                  if (m.indexOf('startTime') !== -1 || m.indexOf('reportAllChanges') !== -1) {
                    return true;
                  }
                  if (origOnError) return origOnError.apply(this, arguments);
                  return false;
                };
                window.addEventListener('error', function(e) {
                  var m = String((e && e.message) || (e && e.error && e.error.message) || '');
                  if (m.indexOf('startTime') !== -1 || m.indexOf('reportAllChanges') !== -1) {
                    e.preventDefault();
                    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                    return true;
                  }
                }, true);
                window.addEventListener('unhandledrejection', function(e) {
                  var m = String((e && e.reason && e.reason.message) || (e && e.reason) || '');
                  if (m.indexOf('startTime') !== -1 || m.indexOf('reportAllChanges') !== -1) {
                    e.preventDefault();
                    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                  }
                }, true);
              })();
            `,
          }}
        />
      </head>
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
