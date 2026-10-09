import Link from 'next/link';
import { Phone, Instagram, MapPin, Calendar, Clock, Sparkles } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#0C0104]/90 backdrop-blur-md border-t border-amber-400/30 text-amber-100/80 pt-16 pb-12 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-xl font-black tracking-wider gold-gradient-text uppercase font-display">
                RAAS IN TAAL
              </span>
            </div>
            <p className="text-xs text-amber-100/70 leading-relaxed">
              Jaipur&apos;s premier Dandiya &amp; Garba celebration featuring traditional Durga Puja rituals, energetic dhol beats, delicious food stalls, and an electrifying dance arena.
            </p>
            <div className="text-xs text-amber-400 font-extrabold uppercase tracking-wide">
              Presented by Chaos and Chill
            </div>
          </div>

          {/* Event Details Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-amber-400 tracking-widest uppercase">Event Details</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <span className="text-white font-semibold">Sunday, 18 October 2026</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-semibold">Durga Puja: 5:30 PM</p>
                  <p className="text-amber-200/80">Dandiya Night: 6:00 PM onwards</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <span className="text-amber-100/80">Khelcity Multi-Sports Arena, Shivam Nagar, Jagatpura, Jaipur, Rajasthan</span>
              </div>
            </div>
          </div>

          {/* Contact Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-amber-400 tracking-widest uppercase">Contact &amp; Support</h4>
            <div className="space-y-2 text-xs">
              <p className="text-amber-100/70">For ticket inquiries or venue directions:</p>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-orange-400" />
                <a href="tel:8003022503" className="hover:text-amber-300 transition-colors font-bold text-white">
                  +91 80030 22503
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-orange-400" />
                <a href="tel:8278695419" className="hover:text-amber-300 transition-colors font-bold text-white">
                  +91 82786 95419
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-400" />
                <a
                  href="https://instagram.com/chaos_and_chill"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-pink-300 transition-colors font-bold text-pink-300 underline underline-offset-2"
                >
                  @chaos_and_chill
                </a>
              </div>
            </div>
          </div>

          {/* Policy & Capacity Notice */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-amber-400 tracking-widest uppercase">Gate &amp; Capacity</h4>
            <div className="p-3.5 bg-[#19030A] rounded-2xl border border-amber-400/20 text-xs space-y-2">
              <p className="font-bold text-amber-300">Strict 500 Attendees Limit</p>
              <p className="text-amber-100/70 leading-relaxed text-[11px]">
                To guarantee safety and a premium experience, entry is strictly restricted to 500 attendees across all categories.
              </p>
              <p className="text-[10px] text-amber-300/60 pt-1 border-t border-amber-400/10">
                1 QR pass per booking with individual attendee entry tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-amber-400/20 flex flex-col sm:flex-row items-center justify-between text-xs text-amber-100/50 gap-4">
          <p>© 2026 Chaos and Chill. All rights reserved. Raas in Taal.</p>
          <div className="flex items-center gap-6">
            <Link href="/#rules" className="hover:text-amber-300 transition-colors">
              Terms &amp; Cancellation Policy
            </Link>
            <Link href="/scanner" className="hover:text-amber-300 transition-colors">
              Gate Scanner
            </Link>
            <Link href="/admin" className="hover:text-amber-300 transition-colors">
              Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
