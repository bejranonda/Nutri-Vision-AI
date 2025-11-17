import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NutriVision AI - Smart Nutrition Assistant",
  description: "AI-powered nutrition analysis for Thai cuisine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.Node;
}>) {
  return children;
}
