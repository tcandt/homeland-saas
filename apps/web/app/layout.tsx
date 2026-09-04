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
                function shouldIgnore(errOrMsg) {
                  if (!errOrMsg) return false;
                  var str = typeof errOrMsg === 'string' ? errOrMsg : ((errOrMsg && (errOrMsg.message || errOrMsg.stack)) || String(errOrMsg));
                  return str.indexOf('startTime') !== -1 ||
                         str.indexOf('reportAllChanges') !== -1 ||
                         str.indexOf('ERR_QUIC_PROTOCOL_ERROR') !== -1 ||
                         str.indexOf('notifications/stream') !== -1;
                }

                // 1. Safe PerformanceObserver proxy preserving constructor semantics
                if (typeof window !== 'undefined' && window.PerformanceObserver) {
                  try {
                    var OrigObserver = window.PerformanceObserver;
                    var SafeObserver = function(callback) {
                      var safeCallback = function(list, observer) {
                        try {
                          callback(list, observer);
                        } catch (err) {
                          // Ignore web vitals / beacon internal errors
                        }
                      };
                      try {
                        return Reflect.construct(OrigObserver, [safeCallback], new.target || SafeObserver);
                      } catch (e) {
                        return new OrigObserver(safeCallback);
                      }
                    };
                    SafeObserver.prototype = OrigObserver.prototype;
                    try {
                      Object.defineProperty(SafeObserver, 'supportedEntryTypes', {
                        get: function() { return OrigObserver.supportedEntryTypes; },
                        configurable: true,
                        enumerable: true
                      });
                    } catch (e) {}
                    window.PerformanceObserver = SafeObserver;
                  } catch (e) {}
                }

                // 2. Guard console.error from reporting startTime/reportAllChanges/QUIC stream errors
                if (typeof window !== 'undefined' && window.console && window.console.error) {
                  var origConsoleError = window.console.error;
                  window.console.error = function() {
                    for (var i = 0; i < arguments.length; i++) {
                      if (shouldIgnore(arguments[i])) {
                        return;
                      }
                    }
                    return origConsoleError.apply(window.console, arguments);
                  };
                }

                // 3. Guard window.onerror
                var origOnError = window.onerror;
                window.onerror = function(msg, url, line, col, error) {
                  if (shouldIgnore(msg) || shouldIgnore(error) || shouldIgnore(url)) {
                    return true;
                  }
                  if (origOnError) return origOnError.apply(this, arguments);
                  return false;
                };

                window.addEventListener('error', function(e) {
                  if (shouldIgnore(e && e.message) || shouldIgnore(e && e.error) || shouldIgnore(e && e.filename)) {
                    e.preventDefault();
                    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                    return true;
                  }
                }, true);

                window.addEventListener('unhandledrejection', function(e) {
                  if (shouldIgnore(e && e.reason)) {
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
