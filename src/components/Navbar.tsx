'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Shield, QrCode, Ticket, Calendar, FileText, Phone, Home } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#120206]/95 backdrop-blur-md border-b border-raas-gold/30 shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[88px]">
          {/* 1. Logo & Brand Section */}
          <Link href="/" className="flex items-center gap-3.5 shrink-0 group py-1">
            <img
              src="/assets/chaos_and_chill_logo.png"
              alt="Chaos and Chill Logo"
              className="w-14 h-14 object-contain rounded-xl border border-amber-400/35 shadow-[0_0_15px_rgba(245,130,32,0.25)] group-hover:scale-105 transition-transform shrink-0"
            />
            <div className="flex flex-col justify-center">
              <span className="font-royal font-black tracking-widest text-2xl sm:text-[26px] gold-gradient-text uppercase leading-tight drop-shadow-sm whitespace-nowrap">
                RAAS IN TAAL
              </span>
              <span className="text-[9.5px] sm:text-[10.5px] font-bold tracking-widest text-amber-300/90 uppercase leading-none whitespace-nowrap">
                A Dandiya Night by Chaos and Chill
              </span>
            </div>
          </Link>

          {/* 2. Navigation Menu (Centered, Single Row, Perfect Alignment) */}
          <div className="hidden lg:flex items-center gap-5 xl:gap-7">
            <Link
              href="/account"
              className="inline-flex items-center gap-2 text-sm font-semibold text-raas-cream/90 hover:text-amber-300 transition-colors whitespace-nowrap"
            >
              <Home className="w-[18px] h-[18px] text-raas-gold shrink-0" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/#tickets"
              className="inline-flex items-center gap-2 text-sm font-semibold text-raas-cream/90 hover:text-amber-300 transition-colors whitespace-nowrap"
            >
              <Ticket className="w-[18px] h-[18px] text-raas-gold shrink-0" />
              <span>Book Tickets</span>
            </Link>
            <Link
              href="/#schedule"
              className="inline-flex items-center gap-2 text-sm font-semibold text-raas-cream/90 hover:text-amber-300 transition-colors whitespace-nowrap"
            >
              <Calendar className="w-[18px] h-[18px] text-raas-gold shrink-0" />
              <span>Event Schedule</span>
            </Link>
            <Link
              href="/#rules"
              className="inline-flex items-center gap-2 text-sm font-semibold text-raas-cream/90 hover:text-amber-300 transition-colors whitespace-nowrap"
            >
              <FileText className="w-[18px] h-[18px] text-raas-gold shrink-0" />
              <span>Rules & Guidelines</span>
            </Link>
            <Link
              href="/#contact"
              className="inline-flex items-center gap-2 text-sm font-semibold text-raas-cream/90 hover:text-amber-300 transition-colors whitespace-nowrap"
            >
              <Phone className="w-[18px] h-[18px] text-raas-gold shrink-0" />
              <span>Contact</span>
            </Link>
          </div>

          {/* 3. Action Buttons (Single Row, 40px Height, Gold Button) */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <Link
              href="/scanner"
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-full border border-amber-400/35 text-xs font-bold text-amber-300 hover:bg-amber-400/10 transition-colors whitespace-nowrap"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Staff Gate</span>
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-full border border-orange-400/35 text-xs font-bold text-orange-300 hover:bg-orange-400/10 transition-colors whitespace-nowrap"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
            <Link
              href="/#tickets"
              className="gold-gradient-btn inline-flex items-center justify-center gap-2 h-[40px] px-5 rounded-full text-xs font-black tracking-wider uppercase shadow-md hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] whitespace-nowrap hover:scale-105 transition-all"
            >
              <Ticket className="w-4 h-4 shrink-0" />
              <span>Book Now</span>
            </Link>
          </div>

          {/* 4. Mobile & Tablet Menu Trigger */}
          <div className="md:hidden flex items-center gap-2.5">
            <Link
              href="/#tickets"
              className="gold-gradient-btn inline-flex items-center justify-center h-[36px] px-3.5 rounded-full text-xs font-black uppercase shadow-sm"
            >
              Book
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-amber-300 hover:bg-[#28060F] border border-amber-400/25 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Mobile & Tablet Collapsible Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#1E040B] border-b border-raas-gold/30 px-5 pt-4 pb-7 space-y-3 shadow-2xl">
          <Link
            href="/account"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-raas-cream hover:bg-[#320713]"
          >
            <Home className="w-4 h-4 text-raas-gold" />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/#tickets"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-raas-cream hover:bg-[#320713]"
          >
            <Ticket className="w-4 h-4 text-raas-gold" />
            <span>Book Tickets</span>
          </Link>
          <Link
            href="/#schedule"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-raas-cream hover:bg-[#320713]"
          >
            <Calendar className="w-4 h-4 text-raas-gold" />
            <span>Event Schedule & Venue</span>
          </Link>
          <Link
            href="/#rules"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-raas-cream hover:bg-[#320713]"
          >
            <FileText className="w-4 h-4 text-raas-gold" />
            <span>Rules & Guidelines</span>
          </Link>
          <Link
            href="/#contact"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-raas-cream hover:bg-[#320713]"
          >
            <Phone className="w-4 h-4 text-raas-gold" />
            <span>Contact & Support</span>
          </Link>

          <div className="pt-3 border-t border-raas-gold/20 flex gap-2.5">
            <Link
              href="/scanner"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 text-center py-2.5 rounded-xl border border-amber-400/40 text-xs font-bold text-amber-300 bg-[#28060F]"
            >
              Staff Scanner
            </Link>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 text-center py-2.5 rounded-xl border border-orange-400/40 text-xs font-bold text-orange-300 bg-[#28060F]"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
