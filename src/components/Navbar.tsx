'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Sparkles, Shield, QrCode } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#140207]/85 backdrop-blur-md border-b border-raas-gold/35 shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo & Presentation Text */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-raas-marigold via-raas-gold to-yellow-200 flex items-center justify-center text-raas-maroon-deep shadow-[0_0_15px_rgba(229,169,60,0.5)] group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6 animate-pulse text-[#1A0307]" />
            </div>
            <div>
              <span className="block text-xl sm:text-2xl font-black tracking-widest gold-gradient-text uppercase font-display drop-shadow-sm">
                RAAS IN TAAL
              </span>
              <span className="block text-[10px] sm:text-[11px] font-bold tracking-widest text-amber-400/90 uppercase">
                A Dandiya Night by Chaos and Chill
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/#tickets"
              className="text-xs sm:text-sm font-semibold text-raas-cream/90 hover:text-amber-300 transition-colors"
            >
              Book Tickets
            </Link>
            <Link
              href="/#schedule"
              className="text-xs sm:text-sm font-semibold text-raas-cream/90 hover:text-amber-300 transition-colors"
            >
              Event Schedule
            </Link>
            <Link
              href="/#rules"
              className="text-xs sm:text-sm font-semibold text-raas-cream/90 hover:text-amber-300 transition-colors"
            >
              Rules & Guidelines
            </Link>
            <Link
              href="/#contact"
              className="text-xs sm:text-sm font-semibold text-raas-cream/90 hover:text-amber-300 transition-colors"
            >
              Contact
            </Link>
            <Link
              href="/scanner"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/35 text-xs font-bold text-amber-300 hover:bg-amber-400/10 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              Staff Gate
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-400/35 text-xs font-bold text-orange-300 hover:bg-orange-400/10 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </Link>
            <Link
              href="/#tickets"
              className="gold-gradient-btn px-6 py-2.5 rounded-full text-xs sm:text-sm font-black tracking-wide"
            >
              Book Now
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3">
            <Link
              href="/#tickets"
              className="gold-gradient-btn px-4 py-1.5 rounded-full text-xs font-bold"
            >
              Book
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-amber-300 hover:bg-[#28060F]"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#1E040B] border-b border-raas-gold/30 px-5 pt-4 pb-7 space-y-3.5 shadow-2xl">
          <Link
            href="/#tickets"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-raas-cream hover:bg-[#320713]"
          >
            Book Tickets
          </Link>
          <Link
            href="/#schedule"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-raas-cream hover:bg-[#320713]"
          >
            Event Schedule & Venue
          </Link>
          <Link
            href="/#rules"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-raas-cream hover:bg-[#320713]"
          >
            Rules & Guidelines
          </Link>
          <Link
            href="/#contact"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-raas-cream hover:bg-[#320713]"
          >
            Contact & Support
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
