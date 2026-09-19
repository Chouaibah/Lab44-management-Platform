import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lab44 — Lab Management Platform",
  description: "Student grades, VM management, attendance, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {/*
            closeButton adds a dismiss (×) button to every toast. Some toasts are
            intentionally long-lived — the ownCloud one stays up to 15s because it
            may carry a password — so they need a manual way out.
          */}
          <Toaster
            richColors
            position="top-right"
            closeButton
            visibleToasts={4}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
