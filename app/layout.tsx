import type { Metadata } from "next";
import { Geist, Fraunces, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";

import {
  buildOneSignalInitScript,
  getOneSignalAllowedOrigins,
  getOneSignalAppId,
} from "@/lib/onesignal-web-sdk";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"],
});
const oneSignalAllowedOrigins = getOneSignalAllowedOrigins();
const oneSignalAppId = getOneSignalAppId();
const oneSignalInitScript = oneSignalAppId
  ? buildOneSignalInitScript(oneSignalAppId, oneSignalAllowedOrigins)
  : null;

export const metadata: Metadata = {
  title: "Tape",
  description: "Tape is your team meeting transcript workspace",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn(
        "font-sans",
        geist.variable,
        fraunces.variable,
        spaceGrotesk.variable,
        ibmPlexMono.variable,
      )}
    >
      <body>
        {children}
        {oneSignalInitScript ? (
          <>
            <Script id="onesignal-init" strategy="beforeInteractive">
              {oneSignalInitScript}
            </Script>
            <Script
              src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
              strategy="afterInteractive"
            />
          </>
        ) : null}
      </body>
    </html>
  );
}
