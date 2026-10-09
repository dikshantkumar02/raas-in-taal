import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Raas in Taal 2026 — Dandiya Night by Chaos and Chill | Jaipur',
  description:
    'Join Raas in Taal on Sunday, 18 October 2026 at Khelcity Multi-Sports Arena, Jagatpura, Jaipur. Official ticket booking with PhonePe integration and instant QR gate passes. Limited to 500 attendees.',
  keywords: [
    'Raas in Taal',
    'Dandiya Night Jaipur',
    'Garba Jaipur 2026',
    'Chaos and Chill',
    'Khelcity Jagatpura',
    'Durga Puja Jaipur',
  ],
  openGraph: {
    title: 'Raas in Taal 2026 — Dandiya Night | Jaipur',
    description: 'Celebrate Navratri & Durga Puja with Dandiya Night at Khelcity Arena, Jaipur. Book official passes.',
    type: 'website',
    locale: 'en_IN',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-festive-pattern text-raas-cream selection:bg-raas-marigold selection:text-raas-maroon-deep">
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
