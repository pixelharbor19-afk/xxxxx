import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ui/theme-provider";
import Provider from "./provider";
import Script from "next/script";
import DevToolGuard from "@/components/ui/debug_guard";
import AdScript from "./ad-script";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "ZXC[STREAM] — Stream & Download",
  description: "Stream or download movies and TV by TMDB ID.",
  applicationName: "ZXC[STREAM]",
  authors: [{ name: "ZXC[STREAM]" }],
  referrer: "strict-origin-when-cross-origin",

  openGraph: {
    title: "ZXC[STREAM]",
    description: "Stream or download movies and TV by TMDB ID.",
    type: "website",
  },

  twitter: {
    card: "summary",
    title: "ZXC[STREAM]",
    description: "Stream or download movies and TV by TMDB ID.",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        figtree.variable,
      )}
    >
      <head>
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-X84FLTN1EC"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-X84FLTN1EC');
            `,
          }}
        />
      </head>

      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Provider>
            {children} <AdScript />
          </Provider>
        </ThemeProvider>

        {isProduction && <DevToolGuard />}
      </body>
    </html>
  );
}
