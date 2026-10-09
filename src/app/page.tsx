import Link from 'next/link';
import { db } from '@/lib/db/store';
import { Sparkles, Calendar, Clock, MapPin, Users, Heart, Users2, Home, CheckCircle2, AlertCircle, Phone, Instagram } from 'lucide-react';

export default async function HomePage() {
  const categories = db.getTicketCategories();
  const capacity = await db.getCapacityStatus();
  const event = db.getEventConfig();

  const categoryIcons: Record<string, React.ReactNode> = {
    stag_girls: <Sparkles className="w-6 h-6 text-raas-gold" />,
    couple: <Heart className="w-6 h-6 text-raas-gold" />,
    group: <Users className="w-6 h-6 text-raas-gold" />,
    family: <Home className="w-6 h-6 text-raas-gold" />,
  };

  return (
    <div className="space-y-24 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative pt-16 sm:pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden text-center">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-raas-marigold/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-raas-maroon-mid border border-raas-gold/40 text-xs sm:text-sm font-semibold text-raas-gold shadow-sm">
            <Sparkles className="w-4 h-4 text-raas-marigold" />
            <span>Chaos and Chill Presents Jaipur&apos;s Ultimate Dandiya Night</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight gold-gradient-text uppercase">
            Raas in Taal
          </h1>

          <p className="text-lg sm:text-2xl text-raas-cream/90 max-w-2xl mx-auto font-medium">
            Immerse yourself in royal festive rhythms, vibrant garba spins, and divine celebrations under the Jaipur stars.
          </p>

          {/* Event Quick Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-6 text-left">
            <div className="p-4 rounded-xl bg-raas-maroon-mid/80 border border-raas-gold/30 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-raas-marigold shrink-0" />
                <div>
                  <p className="text-xs text-raas-cream/60 uppercase tracking-wider font-semibold">Date</p>
                  <p className="text-sm font-bold text-raas-cream">Sunday, 18 Oct 2026</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-raas-maroon-mid/80 border border-raas-gold/30 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-raas-marigold shrink-0" />
                <div>
                  <p className="text-xs text-raas-cream/60 uppercase tracking-wider font-semibold">Schedule</p>
                  <p className="text-xs font-bold text-raas-cream">Puja: 5:30 PM | Raas: 6:00 PM</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-raas-maroon-mid/80 border border-raas-gold/30 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-raas-marigold shrink-0" />
                <div>
                  <p className="text-xs text-raas-cream/60 uppercase tracking-wider font-semibold">Venue</p>
                  <p className="text-xs font-bold text-raas-cream line-clamp-1">Khelcity Arena, Jagatpura</p>
                </div>
              </div>
            </div>
          </div>

          {/* Capacity Alert & Main CTA */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#tickets"
              className="gold-gradient-btn px-8 py-4 rounded-full text-base sm:text-lg font-bold shadow-xl tracking-wide flex items-center gap-2 group w-full sm:w-auto justify-center"
            >
              <span>Book Gate Passes</span>
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </a>

            <div className="flex items-center gap-2 px-4 py-3 rounded-full bg-raas-maroon-deep/90 border border-raas-marigold/30 text-xs text-raas-marigold-light font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>
                {capacity.availableAttendees > 0
                  ? `${capacity.availableAttendees} of 500 attendee slots remaining`
                  : 'SOLD OUT (Max 500 Capacity Reached)'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TICKET CATEGORIES SECTION */}
      <section id="tickets" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-12">
          <div className="inline-block text-xs font-bold tracking-widest text-raas-marigold uppercase">
            Official Ticketing Categories
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold gold-gradient-text">
            Choose Your Entry Package
          </h2>
          <p className="text-sm text-raas-cream/70 max-w-xl mx-auto">
            Strict overall capacity of 500 attendees. Each booking generates one secure QR gate pass that tracks admitted attendees at the gate.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => {
            const priceInRupees = cat.pricePaise / 100;
            const isGroup = cat.code === 'group';

            return (
              <div
                key={cat.id}
                className="relative rounded-2xl bg-raas-maroon-mid border border-raas-gold/40 p-6 flex flex-col justify-between hover:border-raas-gold hover:shadow-2xl hover:scale-[1.02] transition-all group"
              >
                {isGroup && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-raas-marigold to-raas-gold text-raas-maroon-deep text-[11px] font-extrabold uppercase px-3 py-0.5 rounded-full shadow-md">
                    Popular Squad Pass
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30">
                      {categoryIcons[cat.code] || <Sparkles className="w-6 h-6 text-raas-gold" />}
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-raas-maroon-dark text-raas-gold border border-raas-gold/20">
                      {cat.attendeesPerTicket} {cat.attendeesPerTicket === 1 ? 'Attendee' : 'Attendees'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-raas-cream group-hover:text-raas-gold transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-raas-cream/70 mt-1 min-h-[32px]">{cat.description}</p>
                  </div>

                  <div className="pt-2 border-t border-raas-gold/20">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-raas-gold">₹{priceInRupees}</span>
                      <span className="text-xs text-raas-cream/60">
                        {cat.attendeesPerTicket > 1 ? `/ ${cat.attendeesPerTicket} people` : '/ person'}
                      </span>
                    </div>
                    {cat.eligibilityRule && (
                      <p className="text-[11px] text-raas-marigold-light mt-1.5 flex items-start gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-raas-marigold" />
                        <span>{cat.eligibilityRule}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-6">
                  {capacity.availableAttendees < cat.attendeesPerTicket ? (
                    <button
                      disabled
                      className="w-full py-3 rounded-xl bg-raas-maroon-dark/60 text-raas-cream/40 text-sm font-bold cursor-not-allowed border border-raas-gold/10"
                    >
                      Sold Out
                    </button>
                  ) : (
                    <Link
                      href={`/checkout?category=${cat.code}`}
                      className="w-full block text-center py-3 rounded-xl gold-gradient-btn text-sm font-bold shadow-md"
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

      {/* 3. EVENT SCHEDULE & EXPERIENCE */}
      <section id="schedule" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-raas-maroon-mid/70 border border-raas-gold/30 p-8 sm:p-12 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-10">
            <h2 className="text-3xl font-extrabold gold-gradient-text">
              The Evening Timeline
            </h2>
            <p className="text-sm text-raas-cream/70">
              Celebrate the triumph of good over evil with our divine aarti followed by energetic beats.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-6 rounded-2xl bg-raas-maroon-dark/80 border border-raas-gold/20 flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-raas-marigold/20 flex items-center justify-center text-raas-marigold font-bold text-lg shrink-0">
                01
              </div>
              <div>
                <span className="text-xs font-bold text-raas-gold uppercase tracking-wider">5:30 PM — 6:00 PM</span>
                <h3 className="text-lg font-bold text-raas-cream mt-1">Durga Puja & Divine Aarti</h3>
                <p className="text-xs text-raas-cream/70 mt-2 leading-relaxed">
                  Commence the sacred evening with traditional Vedic chants, floral offerings, and Maha Aarti honoring Maa Durga.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-raas-maroon-dark/80 border border-raas-gold/20 flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-raas-gold/20 flex items-center justify-center text-raas-gold font-bold text-lg shrink-0">
                02
              </div>
              <div>
                <span className="text-xs font-bold text-raas-gold uppercase tracking-wider">6:00 PM Onwards</span>
                <h3 className="text-lg font-bold text-raas-cream mt-1">Dandiya & Garba Night</h3>
                <p className="text-xs text-raas-cream/70 mt-2 leading-relaxed">
                  Electrifying fusion of traditional Gujarati garba, live dhol players, professional DJ sound, and prize categories for best dancers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. EVENT RULES & SAFETY */}
      <section id="rules" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 space-y-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-raas-marigold" />
            <h2 className="text-2xl font-bold text-raas-gold">Event Gate Rules & Ticketing Conditions</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-raas-cream/80">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>One Pass Per Booking:</strong> Your booking QR pass covers all attendees in your package. Partial entry is tracked automatically at the gate.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Strict 500 Limit:</strong> No extra entries or unregistered guests permitted once the 500 limit is filled.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Group Pass Rule:</strong> For Group bookings (4 people), at least 1 female attendee is strictly mandatory.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Refund Policy:</strong> Tickets once booked are strictly non-refundable and non-transferable.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>ID Verification:</strong> Government photo ID may be verified at the entrance alongside your QR gate pass.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Traditional Attire:</strong> Traditional Indian festive attire (Chaniya Choli, Kurta Pajama, Kedia) is warmly encouraged.</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CONTACT & VENUE */}
      <section id="contact" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold gold-gradient-text">Need Assistance?</h2>
          <p className="text-xs sm:text-sm text-raas-cream/70">
            Reach out to our event coordination team directly via phone or Instagram.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <a
            href="tel:8003022503"
            className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-raas-maroon-mid border border-raas-gold/30 hover:border-raas-gold transition-colors text-sm font-bold text-raas-cream"
          >
            <Phone className="w-5 h-5 text-raas-marigold" />
            <span>Call: 80030 22503</span>
          </a>

          <a
            href="tel:8278695419"
            className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-raas-maroon-mid border border-raas-gold/30 hover:border-raas-gold transition-colors text-sm font-bold text-raas-cream"
          >
            <Phone className="w-5 h-5 text-raas-marigold" />
            <span>Call: 82786 95419</span>
          </a>

          <a
            href="https://instagram.com/chaos_and_chill"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-raas-maroon-mid border border-raas-gold/30 hover:border-raas-gold transition-colors text-sm font-bold text-raas-gold"
          >
            <Instagram className="w-5 h-5 text-raas-marigold" />
            <span>@chaos_and_chill</span>
          </a>
        </div>
      </section>
    </div>
  );
}
