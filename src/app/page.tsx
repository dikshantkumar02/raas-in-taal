import Link from 'next/link';
import { db } from '@/lib/db/store';
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Users,
  Heart,
  Home,
  CheckCircle2,
  AlertCircle,
  Phone,
  Instagram,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export default async function HomePage() {
  const categories = db.getTicketCategories();
  const capacity = await db.getCapacityStatus();
  const event = db.getEventConfig();

  // Distinct styling configurations for the 4 colorful ticket cards
  const categoryThemes: Record<
    string,
    {
      cardClass: string;
      badgeText: string;
      badgeBg: string;
      badgeColor: string;
      accentColor: string;
      iconBg: string;
      iconColor: string;
    }
  > = {
    stag_girls: {
      cardClass: 'ticket-card-pink',
      badgeText: 'FEMALE STAG ONLY',
      badgeBg: 'bg-pink-950/80 border-pink-500/50',
      badgeColor: 'text-pink-300',
      accentColor: '#EC4899',
      iconBg: 'bg-pink-500/20 border-pink-500/40',
      iconColor: 'text-pink-400',
    },
    couple: {
      cardClass: 'ticket-card-gold',
      badgeText: 'COUPLE PASS (MALE + FEMALE)',
      badgeBg: 'bg-amber-950/80 border-amber-500/50',
      badgeColor: 'text-amber-300',
      accentColor: '#F59E0B',
      iconBg: 'bg-amber-500/20 border-amber-500/40',
      iconColor: 'text-amber-400',
    },
    group: {
      cardClass: 'ticket-card-purple',
      badgeText: 'SQUAD PASS (1 GIRL MANDATORY)',
      badgeBg: 'bg-purple-950/80 border-purple-500/50',
      badgeColor: 'text-purple-300',
      accentColor: '#A855F7',
      iconBg: 'bg-purple-500/20 border-purple-500/40',
      iconColor: 'text-purple-400',
    },
    family: {
      cardClass: 'ticket-card-teal',
      badgeText: 'FAMILY ENTRY (4 MEMBERS)',
      badgeBg: 'bg-teal-950/80 border-teal-500/50',
      badgeColor: 'text-teal-300',
      accentColor: '#14B8A6',
      iconBg: 'bg-teal-500/20 border-teal-500/40',
      iconColor: 'text-teal-400',
    },
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    stag_girls: <Sparkles className="w-5 h-5 text-pink-400" />,
    couple: <Heart className="w-5 h-5 text-amber-400" />,
    group: <Users className="w-5 h-5 text-purple-400" />,
    family: <Home className="w-5 h-5 text-teal-400" />,
  };

  return (
    <div className="space-y-24 pb-24 overflow-hidden relative">
      {/* 1. HERO SECTION */}
      <section className="relative pt-12 sm:pt-20 pb-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="relative max-w-5xl mx-auto space-y-6">
          {/* Organizer Brand Capsule */}
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#24050E]/80 border border-amber-400/40 text-xs sm:text-sm font-bold text-amber-300 shadow-[0_0_20px_rgba(245,130,32,0.25)] backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
            <span className="tracking-wide uppercase font-semibold">
              Chaos and Chill Presents Jaipur&apos;s Ultimate Dandiya Celebration
            </span>
          </div>

          {/* Grand Cinematic Heading */}
          <div className="space-y-2">
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-wider gold-gradient-text uppercase font-display drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]">
              RAAS IN TAAL
            </h1>
            <p className="text-base sm:text-2xl text-amber-100/90 font-medium max-w-2xl mx-auto drop-shadow-md">
              A Royal Dandiya &amp; Garba Night under the Jaipur stars
            </p>
          </div>

          {/* 3 Information Cards (Date, Schedule, Venue) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-4 text-left">
            <div className="p-4 rounded-2xl glass-festive-card border border-amber-400/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-amber-300/80 uppercase tracking-widest font-bold">Event Date</p>
                  <p className="text-xs sm:text-sm font-extrabold text-white">Sunday, 18 Oct 2026</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl glass-festive-card border border-amber-400/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/25">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-orange-300/80 uppercase tracking-widest font-bold">Schedule</p>
                  <p className="text-xs sm:text-sm font-extrabold text-white">Puja: 5:30 PM | Raas: 6:00 PM</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl glass-festive-card border border-amber-400/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-amber-300/80 uppercase tracking-widest font-bold">Venue Arena</p>
                  <p className="text-xs sm:text-sm font-extrabold text-white line-clamp-1">Khelcity Arena, Jagatpura</p>
                </div>
              </div>
            </div>
          </div>

          {/* Availability Pill & Primary CTA */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#tickets"
              className="gold-gradient-btn px-9 py-4 rounded-full text-base sm:text-lg font-black tracking-wide flex items-center gap-2.5 group w-full sm:w-auto justify-center cursor-pointer shadow-xl"
            >
              <span>Book Gate Passes</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
            </a>

            {/* Real Attendee Availability Pill */}
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-[#180309]/90 border border-amber-400/35 text-xs text-amber-200 font-bold backdrop-blur-md shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span>
                {capacity.availableAttendees > 0
                  ? `${capacity.availableAttendees} of 500 attendee slots remaining`
                  : 'SOLD OUT (500 Maximum Capacity Filled)'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TICKET CATEGORIES SECTION (Pink, Gold, Purple, Teal Cards) */}
      <section id="tickets" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#28060F] border border-amber-400/30 text-[11px] font-extrabold text-amber-400 uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official Gate Pass Categories</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold gold-gradient-text uppercase font-display">
            Select Your Entry Pass
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/70 max-w-xl mx-auto leading-relaxed">
            Strict overall capacity of 500 attendees across all categories. Each booking provides 1 secure QR gate pass that tracks admitted attendees at the gate.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => {
            const theme = categoryThemes[cat.code] || categoryThemes.stag_girls;
            const priceInRupees = cat.pricePaise / 100;

            return (
              <div
                key={cat.id}
                className={`relative rounded-3xl bg-[#1E040B]/90 backdrop-blur-md p-6 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] ${theme.cardClass}`}
              >
                {/* Ornamental Top Border Pill */}
                <div className="mb-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${theme.badgeBg} ${theme.badgeColor}`}
                  >
                    {theme.badgeText}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-2xl border ${theme.iconBg}`}>
                      {categoryIcons[cat.code]}
                    </div>
                    <span className="text-xs font-black px-3 py-1 rounded-lg bg-black/40 text-amber-300 border border-amber-400/20">
                      {cat.attendeesPerTicket} {cat.attendeesPerTicket === 1 ? 'Attendee' : 'Attendees'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-amber-100/70 mt-1 min-h-[34px] leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  {/* Price Tag */}
                  <div className="pt-3 border-t border-amber-400/20">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-amber-300">₹{priceInRupees}</span>
                      <span className="text-[11px] text-amber-100/60 font-semibold">
                        {cat.attendeesPerTicket > 1 ? `/ ${cat.attendeesPerTicket} people` : '/ person'}
                      </span>
                    </div>
                    {cat.eligibilityRule && (
                      <p className="text-[11px] text-orange-300 mt-2 flex items-start gap-1 font-semibold leading-snug">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-orange-400" />
                        <span>{cat.eligibilityRule}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Booking Button */}
                <div className="pt-6">
                  {capacity.availableAttendees < cat.attendeesPerTicket ? (
                    <button
                      disabled
                      className="w-full py-3.5 rounded-xl bg-black/40 text-amber-100/30 text-xs font-black cursor-not-allowed border border-amber-400/10 uppercase"
                    >
                      Sold Out
                    </button>
                  ) : (
                    <Link
                      href={`/checkout?category=${cat.code}`}
                      className="w-full block text-center py-3.5 rounded-xl gold-gradient-btn text-xs font-black tracking-wider uppercase shadow-lg hover:shadow-orange-500/40 transition-shadow"
                    >
                      Book {cat.name}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. EVENT TIMELINE SECTION */}
      <section id="schedule" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="rounded-3xl glass-festive-card p-8 sm:p-12 border-2 border-amber-400/35">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              The Evening Program
            </span>
            <h2 className="text-3xl sm:text-4xl font-black gold-gradient-text uppercase font-display">
              Divine Puja &amp; Electrifying Raas
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/70">
              Join us early for traditional rituals followed by high-energy Dandiya beats and delicious food.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Puja Card */}
            <div className="p-6 rounded-2xl bg-[#150207]/90 border border-amber-400/25 flex gap-4 items-start shadow-md">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-black text-lg shrink-0">
                01
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">
                  5:30 PM — 6:00 PM
                </span>
                <h3 className="text-lg font-black text-white">Durga Puja &amp; Maha Aarti</h3>
                <p className="text-xs text-amber-100/75 leading-relaxed pt-1">
                  Commence the sacred evening with traditional floral offerings, divine chants, and aarti honoring Maa Durga.
                </p>
              </div>
            </div>

            {/* Dandiya Card */}
            <div className="p-6 rounded-2xl bg-[#150207]/90 border border-orange-400/25 flex gap-4 items-start shadow-md">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-300 font-black text-lg shrink-0">
                02
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-black text-orange-400 uppercase tracking-widest">
                  6:00 PM Onwards
                </span>
                <h3 className="text-lg font-black text-white">Dandiya &amp; Garba Night</h3>
                <p className="text-xs text-amber-100/75 leading-relaxed pt-1">
                  High-octane traditional dhol players, professional sound setup, DJ mix, and special awards for Best Dressed &amp; Best Dancers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. EVENT RULES & GUIDELINES */}
      <section id="rules" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="p-8 sm:p-10 rounded-3xl glass-festive-card border border-amber-400/35 space-y-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-amber-400" />
            <div>
              <h2 className="text-2xl font-black text-white tracking-wide uppercase font-display">
                Gate Entry Rules &amp; Ticket Conditions
              </h2>
              <p className="text-xs text-amber-200/70">Official guidelines set by Chaos and Chill</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-amber-100/80 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-black/30 border border-amber-400/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>One Pass Per Booking:</strong> Your QR gate pass covers all attendees in your booking package. Partial arrival is permitted and tracked atomically.
              </span>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-black/30 border border-amber-400/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Strict 500 Attendee Cap:</strong> Capacity is strictly restricted to 500 individual attendees for maximum comfort, safety, and a premium arena experience.
              </span>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-black/30 border border-amber-400/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Group Ticket Requirement:</strong> For the Group package (4 people), at least one female attendee is strictly mandatory.
              </span>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-black/30 border border-amber-400/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Non-Refundable Policy:</strong> Tickets once booked are non-refundable and non-transferable except in the event of official cancellation.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CONTACT & VENUE */}
      <section id="contact" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-20">
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black gold-gradient-text uppercase font-display">
            Need Help Or Directions?
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/70">
            Contact the Chaos and Chill event management team directly via phone or Instagram.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5">
          <a
            href="tel:8003022503"
            className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-[#1E040B] border border-amber-400/40 hover:border-amber-400 transition-colors text-xs sm:text-sm font-extrabold text-white shadow-lg"
          >
            <Phone className="w-4 h-4 text-orange-400" />
            <span>Call: 80030 22503</span>
          </a>

          <a
            href="tel:8278695419"
            className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-[#1E040B] border border-amber-400/40 hover:border-amber-400 transition-colors text-xs sm:text-sm font-extrabold text-white shadow-lg"
          >
            <Phone className="w-4 h-4 text-orange-400" />
            <span>Call: 82786 95419</span>
          </a>

          <a
            href="https://instagram.com/chaos_and_chill"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-[#1E040B] border border-pink-500/40 hover:border-pink-400 transition-colors text-xs sm:text-sm font-extrabold text-pink-300 shadow-lg"
          >
            <Instagram className="w-4 h-4 text-pink-400" />
            <span>@chaos_and_chill</span>
          </a>
        </div>
      </section>
    </div>
  );
}
