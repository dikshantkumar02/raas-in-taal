'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Sparkles, Shield, QrCode } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-raas-maroon-deep/90 backdrop-blur-md border-b border-raas-gold/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-raas-marigold to-raas-gold flex items-center justify-center text-raas-maroon-deep shadow-lg group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="block text-xl sm:text-2xl font-bold tracking-wider gold-gradient-text">
                RAAS IN TAAL
              </span>
              <span className="block text-[11px] font-medium tracking-widest text-raas-marigold-light uppercase">
                A Dandiya Night by Chaos and Chill
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/#tickets"
              className="text-sm font-semibold text-raas-cream hover:text-raas-gold transition-colors"
            >
              Book Tickets
            </Link>
            <Link
              href="/#schedule"
              className="text-sm font-semibold text-raas-cream hover:text-raas-gold transition-colors"
            >
              Event Schedule
            </Link>
            <Link
              href="/#rules"
              className="text-sm font-semibold text-raas-cream hover:text-raas-gold transition-colors"
            >
              Rules & Guidelines
            </Link>
            <Link
              href="/#contact"
              className="text-sm font-semibold text-raas-cream hover:text-raas-gold transition-colors"
            >
              Contact
            </Link>
            <Link
              href="/scanner"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-raas-gold/30 text-xs font-semibold text-raas-gold hover:bg-raas-gold/10 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              Staff Gate
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-raas-marigold/30 text-xs font-semibold text-raas-marigold hover:bg-raas-marigold/10 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </Link>
            <Link
              href="/#tickets"
              className="gold-gradient-btn px-5 py-2.5 rounded-full text-sm font-bold shadow-md"
            >
              Book Now
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3">
            <Link
              href="/#tickets"
              className="gold-gradient-btn px-3.5 py-1.5 rounded-full text-xs font-bold"
            >
              Book
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-raas-gold hover:bg-raas-maroon-mid"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-raas-maroon-mid border-b border-raas-gold/30 px-4 pt-3 pb-6 space-y-3">
          <Link
            href="/#tickets"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-semibold text-raas-cream hover:bg-raas-maroon-light"
          >
            Book Tickets
          </Link>
          <Link
            href="/#schedule"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-semibold text-raas-cream hover:bg-raas-maroon-light"
          >
            Event Schedule & Venue
          </Link>
          <Link
            href="/#rules"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-semibold text-raas-cream hover:bg-raas-maroon-light"
          >
            Event Rules
          </Link>
          <Link
            href="/#contact"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-semibold text-raas-cream hover:bg-raas-maroon-light"
          >
            Contact & Support
          </Link>
          <div className="pt-2 border-t border-raas-gold/20 flex gap-2">
            <Link
              href="/scanner"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 text-center py-2 rounded-md border border-raas-gold/40 text-xs font-bold text-raas-gold"
            >
              Staff Scanner
            </Link>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 text-center py-2 rounded-md border border-raas-marigold/40 text-xs font-bold text-raas-marigold"
            >
              Admin Dashboard
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
