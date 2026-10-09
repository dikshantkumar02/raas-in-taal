import Link from 'next/link';
import { Phone, Instagram, MapPin, Calendar, Clock, Sparkles } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-raas-maroon-deep border-t border-raas-gold/30 text-raas-cream/80 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-raas-gold" />
              <span className="text-xl font-bold tracking-wider gold-gradient-text">RAAS IN TAAL</span>
            </div>
            <p className="text-xs text-raas-cream/70 leading-relaxed">
              Jaipur&apos;s premier Dandiya & Garba celebration featuring traditional Durga Puja rituals, energetic dhol beats, delicious food stalls, and an electrifying dance arena.
            </p>
            <div className="text-xs text-raas-marigold font-semibold">
              Presented by Chaos and Chill
            </div>
          </div>

          {/* Event Details Col */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-raas-gold tracking-wider uppercase">Event Details</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-raas-marigold shrink-0 mt-0.5" />
                <span>Sunday, 18 October 2026</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-raas-marigold shrink-0 mt-0.5" />
                <div>
                  <p>Durga Puja: 5:30 PM</p>
                  <p>Dandiya Night: 6:00 PM onwards</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-raas-marigold shrink-0 mt-0.5" />
                <span>Khelcity Multi-Sports Arena, Shivam Nagar, Jagatpura, Jaipur, Rajasthan</span>
              </div>
            </div>
          </div>

          {/* Contact Col */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-raas-gold tracking-wider uppercase">Contact & Support</h4>
            <div className="space-y-2 text-xs">
              <p className="text-raas-cream/70">For ticket inquiries, group bookings, or venue directions:</p>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-raas-marigold" />
                <a href="tel:8003022503" className="hover:text-raas-gold transition-colors font-medium">
                  +91 80030 22503
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-raas-marigold" />
                <a href="tel:8278695419" className="hover:text-raas-gold transition-colors font-medium">
                  +91 82786 95419
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-raas-marigold" />
                <a
                  href="https://instagram.com/chaos_and_chill"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-raas-gold transition-colors font-medium underline underline-offset-2"
                >
                  @chaos_and_chill
                </a>
              </div>
            </div>
          </div>

          {/* Policy & Capacity Notice */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-raas-gold tracking-wider uppercase">Gate & Capacity</h4>
            <div className="p-3 bg-raas-maroon-mid rounded-lg border border-raas-gold/20 text-xs space-y-2">
              <p className="font-semibold text-raas-marigold">Strict 500 Attendees Limit</p>
              <p className="text-raas-cream/70 leading-relaxed">
                To guarantee safety and a premium experience, entry is strictly restricted to 500 attendees across all categories.
              </p>
              <p className="text-[11px] text-raas-cream/50 pt-1 border-t border-raas-gold/10">
                1 QR pass per booking with individual attendee entry tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-raas-gold/20 flex flex-col sm:flex-row items-center justify-between text-xs text-raas-cream/50 gap-4">
          <p>© 2026 Chaos and Chill. All rights reserved. Raas in Taal.</p>
          <div className="flex items-center gap-6">
            <Link href="/#rules" className="hover:text-raas-gold transition-colors">
              Terms & Cancellation Policy
            </Link>
            <Link href="/scanner" className="hover:text-raas-gold transition-colors">
              Gate Scanner
            </Link>
            <Link href="/admin" className="hover:text-raas-gold transition-colors">
              Admin Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
