import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: "Budget",
  description: "Personal budgeting",
  appleWebApp: { capable: true, title: "Budget", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <StoreProvider>
          <main className="mx-auto max-w-[720px] px-5 pt-[max(env(safe-area-inset-top),24px)] pb-28">{children}</main>
          <TabBar />
        </StoreProvider>
      </body>
    </html>
  );
}
