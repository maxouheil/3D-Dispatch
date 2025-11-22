import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D Dispatch Tool",
  description: "Outil interne de dispatch de requêtes 3D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}



