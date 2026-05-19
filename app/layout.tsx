import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { ReactNode } from "react";

export const metadata = {
  title: "SpotPremium - retail bullion premium tracker",
  description:
    "Live dealer premium over spot for 1oz American Silver Eagle and 1oz American Gold Eagle. APMEX, JM Bullion, SD Bullion, Money Metals.",
  openGraph: {
    title: "SpotPremium",
    description: "Retail bullion premium over spot, tracked across four major US dealers."
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg text-text">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
