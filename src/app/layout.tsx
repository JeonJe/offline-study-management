import type { Metadata } from "next";
import { Anton, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-korean",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});

export const metadata: Metadata = {
  title: "Saturday Meetup Dashboard",
  description: "Bootcamp weekly meetup RSVP dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} ${anton.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
