'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Isolate staff portal from customer navbar and footer
  const isStaffPortal = pathname?.startsWith('/staff') || pathname?.startsWith('/scanner');

  if (isStaffPortal) {
    return (
      <main className="min-h-screen flex flex-col relative z-20">
        {children}
      </main>
    );
  }

  return (
    <div className="relative z-20 flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
