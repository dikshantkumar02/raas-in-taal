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
  User,
  QrCode,
  Music,
  Compass,
  Award,
  Flame,
  Venus,
} from 'lucide-react';

export default async function HomePage() {
  const categories = db.getTicketCategories();
  const capacity = await db.getCapacityStatus();
  const event = db.getEventConfig();

  // Starting price calculation
  const minPrice = categories.length > 0 
    ? Math.min(...categories.map((c) => c.pricePaise / 100))
    : 249;

  // Category styling themes
  const categoryMeta: Record<
    string,
    {
      badge: string;
      badgeColor: string;
      icon: React.ReactNode;
      accentBorder: string;
      highlightTag?: string;
    }
  > = {
    stag_girls: {
      badge: 'FEMALE STAG ONLY',
      badgeColor: 'bg-[#2E0B16] text-pink-300 border-pink-500/40',
      icon: <Venus className="w-5 h-5 text-pink-400 stroke-[2.25]" />,
      accentBorder: 'border-pink-500/30 hover:border-pink-500/60',
    },
    couple: {
      badge: 'COUPLE PASS (MALE + FEMALE)',
      badgeColor: 'bg-[#2E1808] text-amber-300 border-amber-500/40',
      icon: <Heart className="w-5 h-5 text-amber-400" />,
      accentBorder: 'border-amber-500/35 hover:border-amber-400/70',
      highlightTag: 'POPULAR CHOICE',
    },
    group: {
      badge: 'SQUAD PASS (1 GIRL MANDATORY)',
      badgeColor: 'bg-[#230B2E] text-purple-300 border-purple-500/40',
      icon: <Users className="w-5 h-5 text-purple-400" />,
      accentBorder: 'border-purple-500/30 hover:border-purple-500/60',
    },
    family: {
      badge: 'FAMILY ENTRY (4 MEMBERS)',
      badgeColor: 'bg-[#0B2520] text-teal-300 border-teal-500/40',
      icon: <Home className="w-5 h-5 text-teal-400" />,
      accentBorder: 'border-teal-500/30 hover:border-teal-500/60',
    },
  };

  return (
    <div className="space-y-24 sm:space-y-32 pb-24 overflow-hidden relative selection:bg-[#D8A743] selection:text-[#090506]">
      {/* ─────────────────────────────────────────────────────────────
          1. CINEMATIC HERO SECTION (~85% Viewport Height)
         ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[calc(85vh-88px)] flex items-center justify-center pt-8 pb-16 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        {/* Authentic Photographic Heritage Backdrop with Smooth Radial Vignette */}
        <div className="absolute inset-0 pointer-events-none select-none z-0">
          <img
            src="/assets/festival_hero_bg.jpg"
            alt="Authentic Dandiya Raas Festival at Heritage Jaipur Courtyard"
            className="w-full h-full object-cover object-center opacity-30 scale-105 transition-transform duration-1000 ease-out"
          />
          {/* Multi-layered cinematic gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#090506]/90 via-[#090506]/75 to-[#090506]" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#090506]/60 to-[#090506]" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#D8A743]/15 via-orange-600/5 to-transparent rounded-full blur-[120px]" />
        </div>

        {/* Hero Central Content */}
        <div className="relative z-10 max-w-5xl mx-auto space-y-6 sm:space-y-8">
          {/* Organizer Brand Capsule */}
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-[#21080D]/90 border border-[#D8A743]/45 shadow-[0_0_25px_rgba(216,167,67,0.25)] backdrop-blur-md">
            <img
              src="/assets/chaos_and_chill_logo.png"
              alt="Chaos and Chill Logo"
              className="h-7 w-auto object-contain rounded-md"
            />
            <span className="tracking-[0.2em] uppercase font-bold text-xs sm:text-sm text-[#FFD780]">
              Chaos and Chill Presents
            </span>
          </div>

          {/* Grand Calligraphic Hero Title */}
          <div className="space-y-2">
            <h1 className="font-royal text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-widest gold-gradient-text uppercase leading-none drop-shadow-[0_12px_40px_rgba(0,0,0,0.95)]">
              RAAS IN TAAL
            </h1>
            <span className="block text-sm sm:text-base md:text-lg font-bold tracking-[0.25em] text-[#D8A743] uppercase pt-1">
              A Dandiya Night by Chaos and Chill
            </span>
            <p className="text-base sm:text-xl text-[#FFF1D6]/90 font-medium max-w-2xl mx-auto pt-2 drop-shadow-md leading-relaxed">
              Immerse yourself in royal festive rhythms, vibrant garba spins, and divine celebrations under the Jaipur stars.
            </p>

            {/* Delicate Diya Mandala Divider */}
            <div className="flex items-center justify-center gap-3 pt-3 pb-1 opacity-85">
              <div className="h-[1px] w-20 sm:w-32 bg-gradient-to-r from-transparent to-[#D8A743]" />
              <span className="text-[#D8A743] text-sm tracking-widest">🪔 ✧ 🪔</span>
              <div className="h-[1px] w-20 sm:w-32 bg-gradient-to-l from-transparent to-[#D8A743]" />
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#tickets"
              className="gold-gradient-btn px-9 py-4 rounded-full text-base sm:text-lg font-black tracking-wide flex items-center gap-2.5 group w-full sm:w-auto justify-center cursor-pointer shadow-[0_0_30px_rgba(216,167,67,0.4)] hover:scale-105 transition-all text-[#090506]"
            >
              <span>Book Your Tickets</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
            </a>

            <a
              href="#about"
              className="px-7 py-4 rounded-full text-sm sm:text-base font-bold tracking-wide flex items-center gap-2 w-full sm:w-auto justify-center border border-[#D8A743]/50 text-[#FFF1D6] bg-[#21080D]/75 hover:bg-[#3B0C14] hover:border-[#FFD780] transition-all shadow-md"
            >
              <Compass className="w-4 h-4 text-[#D8A743]" />
              <span>Explore Event</span>
            </a>
          </div>

          {/* Availability Pill & Quick Customer Access */}
          <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#180309]/95 border border-[#D8A743]/35 text-xs text-[#FFF1D6] font-semibold backdrop-blur-md shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span>
                {capacity.availableAttendees > 0
                  ? 'Gate Passes Available • Instant QR Delivery'
                  : 'Passes Sold Out'}
              </span>
            </div>

            <Link
              href="/account"
              className="px-4 py-2 rounded-full bg-[#21080D]/90 hover:bg-[#3B0C14] border border-[#D8A743]/40 text-xs font-bold text-[#FFD780] flex items-center gap-2 backdrop-blur-md transition-all shadow-sm hover:scale-105"
            >
              <User className="w-3.5 h-3.5 text-[#D8A743]" />
              <span>Customer Login &amp; My Passes</span>
            </Link>

            <Link
              href="/scanner"
              className="px-4 py-2 rounded-full bg-[#21080D]/90 hover:bg-[#3B0C14] border border-orange-400/40 text-xs font-bold text-orange-300 flex items-center gap-2 backdrop-blur-md transition-all shadow-sm hover:scale-105"
            >
              <QrCode className="w-3.5 h-3.5 text-orange-400" />
              <span>Staff Gate Scanner</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. PREMIUM EVENT INFORMATION STRIP
         ───────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="rounded-2xl bg-[#21080D]/90 border border-[#D8A743]/35 shadow-2xl backdrop-blur-md p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-[#D8A743]/20">
            {/* Date */}
            <div className="flex items-center gap-3.5 px-3 py-2">
              <div className="p-2.5 rounded-xl bg-[#D8A743]/15 text-[#D8A743] border border-[#D8A743]/30 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#C8B9B0] uppercase tracking-widest font-black">Event Date</p>
                <p className="text-sm font-extrabold text-[#FFF1D6]">Sunday, 18 Oct 2026</p>
              </div>
            </div>

            {/* Venue */}
            <div className="flex items-center gap-3.5 px-3 py-2 pt-3 sm:pt-2">
              <div className="p-2.5 rounded-xl bg-[#D8A743]/15 text-[#D8A743] border border-[#D8A743]/30 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#C8B9B0] uppercase tracking-widest font-black">Venue Arena</p>
                <p className="text-sm font-extrabold text-[#FFF1D6] line-clamp-1">Khelcity Arena, Jagatpura</p>
              </div>
            </div>

            {/* Timing */}
            <div className="flex items-center gap-3.5 px-3 py-2 pt-3 sm:pt-2">
              <div className="p-2.5 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#C8B9B0] uppercase tracking-widest font-black">Schedule</p>
                <p className="text-sm font-extrabold text-[#FFF1D6]">Puja: 5:30 PM | Raas: 6:00 PM</p>
              </div>
            </div>

            {/* Pricing */}
            <div className="flex items-center gap-3.5 px-3 py-2 pt-3 sm:pt-2">
              <div className="p-2.5 rounded-xl bg-[#D8A743]/15 text-[#D8A743] border border-[#D8A743]/30 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#C8B9B0] uppercase tracking-widest font-black">Gate Passes</p>
                <p className="text-sm font-extrabold text-[#FFD780]">Starting from ₹{minPrice}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. ABOUT THE EVENT (Editorial Two-Column Section)
         ───────────────────────────────────────────────────────────── */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Authentic Photography in Royal Frame */}
          <div className="lg:col-span-5 relative group">
            <div className="relative rounded-3xl overflow-hidden border-2 border-[#D8A743]/40 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
              <img
                src="/assets/festival_dhol_live.jpg"
                alt="Live Dandiya Raas celebration with traditional Dhol drummers and dancers"
                className="w-full h-[420px] object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#090506] via-transparent to-transparent opacity-80" />

              {/* Bottom Caption Pill */}
              <div className="absolute bottom-5 left-5 right-5 p-4 rounded-2xl bg-[#21080D]/90 border border-[#D8A743]/30 backdrop-blur-md">
                <p className="text-xs font-bold text-[#FFD780] uppercase tracking-wider">
                  Authentic Dhol &amp; Heritage Garba Beats
                </p>
                <p className="text-[11px] text-[#FFF1D6]/80 mt-0.5">
                  Live traditional rhythms celebrating the divine spirit of Navratri
                </p>
              </div>
            </div>

            {/* Corner Decorative Medallion */}
            <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-[#21080D] border border-[#D8A743]/50 flex items-center justify-center text-[#D8A743] shadow-lg">
              ✦
            </div>
          </div>

          {/* Right Column: Editorial Copy */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#21080D] border border-[#D8A743]/40 text-xs font-bold text-[#D8A743] uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>A Royal Navratri Celebration</span>
            </div>

            <div className="space-y-3">
              <h2 className="font-royal text-3xl sm:text-4xl md:text-5xl font-black gold-gradient-text uppercase leading-tight">
                Where Heritage Tradition Meets Electrifying Beats
              </h2>
              <p className="text-sm sm:text-base text-[#FFF1D6]/85 leading-relaxed">
                Raas in Taal brings together the majestic royalty of Jaipur and the joyous devotion of Navratri into an unforgettable cultural celebration under the open night sky.
              </p>
              <p className="text-xs sm:text-sm text-[#C8B9B0] leading-relaxed">
                Begin the evening with auspicious Durga Puja rituals, traditional floral offerings, and aarti honoring Maa Durga. As twilight deepens, immerse yourself into a high-octane celebration driven by thunderous live dhol players, professional sound staging, and the irresistible rhythm of traditional Dandiya and Garba spins.
              </p>
            </div>

            {/* 4 Feature Points */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#21080D]/80 border border-[#D8A743]/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-[#FFF1D6]">Auspicious Durga Puja &amp; Aarti</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#21080D]/80 border border-[#D8A743]/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-[#FFF1D6]">Live Traditional Dhol Troops</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#21080D]/80 border border-[#D8A743]/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-[#FFF1D6]">Best Attire &amp; Dancer Awards</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#21080D]/80 border border-[#D8A743]/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-[#FFF1D6]">Verified Instant QR Gate Passes</span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="#schedule"
                className="inline-flex items-center gap-2 text-xs font-extrabold text-[#FFD780] hover:text-[#FFF1D6] transition-colors border-b border-[#D8A743]/40 pb-1"
              >
                <span>View Full Evening Schedule &amp; Timings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. LIVE FESTIVAL ATMOSPHERE (Editorial Gallery)
         ───────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#21080D] border border-[#D8A743]/35 text-xs font-bold text-[#D8A743] uppercase tracking-widest">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>The Festival Atmosphere</span>
          </div>
          <h2 className="font-royal text-3xl sm:text-5xl font-black gold-gradient-text uppercase">
            A Feast of Colors, Music &amp; Devotion
          </h2>
          <p className="text-xs sm:text-sm text-[#C8B9B0] max-w-xl mx-auto leading-relaxed">
            Experience the warmth of Jaipur festive hospitality, authentic traditional attire, and the unmatched joy of dancing with friends and family.
          </p>
        </div>

        {/* 3 Staggered Editorial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Courtyard Dandiya Raas */}
          <div className="rounded-3xl bg-[#21080D]/80 border border-[#D8A743]/30 overflow-hidden shadow-xl group">
            <div className="h-64 overflow-hidden relative">
              <img
                src="/assets/festival_hero_bg.jpg"
                alt="Heritage Courtyard Dandiya Raas"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#21080D] via-transparent to-transparent" />
            </div>
            <div className="p-6 space-y-2 text-left">
              <span className="text-[10px] font-bold text-[#D8A743] uppercase tracking-widest">
                Traditional Raas
              </span>
              <h3 className="text-lg font-black text-[#FFF1D6]">Grand Heritage Courtyard</h3>
              <p className="text-xs text-[#C8B9B0] leading-relaxed">
                Spacious open-air arena under heritage-style lighting, fairy lights, and traditional earthen diyas.
              </p>
            </div>
          </div>

          {/* Card 2: Dhol drummers */}
          <div className="rounded-3xl bg-[#21080D]/80 border border-[#D8A743]/30 overflow-hidden shadow-xl group">
            <div className="h-64 overflow-hidden relative">
              <img
                src="/assets/festival_dhol_live.jpg"
                alt="Live Dhol Beats and Garba celebration"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#21080D] via-transparent to-transparent" />
            </div>
            <div className="p-6 space-y-2 text-left">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                High-Energy Beats
              </span>
              <h3 className="text-lg font-black text-[#FFF1D6]">Thunderous Live Dhol</h3>
              <p className="text-xs text-[#C8B9B0] leading-relaxed">
                Traditional Punjabi and Rajasthani Dhol drummers keeping every Garba circle energized all night long.
              </p>
            </div>
          </div>

          {/* Card 3: Authentic Attire */}
          <div className="rounded-3xl bg-[#21080D]/80 border border-[#D8A743]/30 overflow-hidden shadow-xl group">
            <div className="h-64 overflow-hidden relative">
              <img
                src="/assets/female_dancer.jpg"
                alt="Authentic traditional Gujarati Chaniya Choli and Kediyu attire"
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#21080D] via-transparent to-transparent" />
            </div>
            <div className="p-6 space-y-2 text-left">
              <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">
                Cultural Splendor
              </span>
              <h3 className="text-lg font-black text-[#FFF1D6]">Mirror-Work &amp; Chaniya Choli</h3>
              <p className="text-xs text-[#C8B9B0] leading-relaxed">
                Celebrate in your finest traditional attire with special recognition for Best Dressed Dancers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. EVENT HIGHLIGHTS & SCHEDULE SECTION
         ───────────────────────────────────────────────────────────── */}
      <section id="schedule" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="rounded-3xl bg-[#21080D]/90 p-8 sm:p-12 border-2 border-[#D8A743]/35 shadow-2xl">
          <div className="max-w-3xl mx-auto text-center space-y-3 mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-[#D8A743]">
              The Evening Program
            </span>
            <h2 className="font-royal text-3xl sm:text-4xl font-black gold-gradient-text uppercase">
              Divine Puja &amp; Electrifying Raas
            </h2>
            <p className="text-xs sm:text-sm text-[#C8B9B0]">
              Join us early for traditional rituals followed by high-energy Dandiya beats, delicious refreshments, and awards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* 01: Puja */}
            <div className="p-6 rounded-2xl bg-[#120306]/95 border border-[#D8A743]/25 flex gap-4 items-start shadow-md hover:border-[#D8A743]/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-[#D8A743]/15 border border-[#D8A743]/35 flex items-center justify-center text-[#FFD780] font-black text-lg shrink-0">
                01
              </div>
              <div className="space-y-1 text-left">
                <span className="text-[11px] font-black text-[#D8A743] uppercase tracking-widest">
                  5:30 PM — 6:00 PM
                </span>
                <h3 className="text-lg font-black text-[#FFF1D6]">Durga Puja &amp; Maha Aarti</h3>
                <p className="text-xs text-[#C8B9B0] leading-relaxed pt-1">
                  Commence the sacred evening with traditional floral offerings, divine chants, and aarti honoring Maa Durga.
                </p>
              </div>
            </div>

            {/* 02: Dandiya */}
            <div className="p-6 rounded-2xl bg-[#120306]/95 border border-orange-500/25 flex gap-4 items-start shadow-md hover:border-orange-500/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/35 flex items-center justify-center text-orange-300 font-black text-lg shrink-0">
                02
              </div>
              <div className="space-y-1 text-left">
                <span className="text-[11px] font-black text-orange-400 uppercase tracking-widest">
                  6:00 PM Onwards
                </span>
                <h3 className="text-lg font-black text-[#FFF1D6]">Dandiya &amp; Garba Raas</h3>
                <p className="text-xs text-[#C8B9B0] leading-relaxed pt-1">
                  High-octane live traditional dhol players, professional sound setup, DJ mix, and special awards for Best Dressed &amp; Best Dancers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. TICKET BOOKING PREVIEW (#tickets)
         ───────────────────────────────────────────────────────────── */}
      <section id="tickets" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#21080D] border border-[#D8A743]/35 text-xs font-black text-[#D8A743] uppercase tracking-widest shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official Gate Pass Categories</span>
          </div>
          <h2 className="font-royal text-3xl sm:text-5xl font-black gold-gradient-text uppercase">
            Select Your Entry Pass
          </h2>
          <p className="text-xs sm:text-sm text-[#C8B9B0] max-w-xl mx-auto leading-relaxed">
            Each booking provides 1 secure QR gate pass that tracks admitted attendees atomically. Sign up or log in to complete your booking.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => {
            const meta = categoryMeta[cat.code] || categoryMeta.stag_girls;
            const priceInRupees = cat.pricePaise / 100;

            return (
              <div
                key={cat.id}
                className={`relative rounded-3xl bg-[#1E050B]/95 backdrop-blur-md p-6 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] border ${meta.accentBorder} shadow-xl hover:shadow-[0_10px_30px_rgba(0,0,0,0.8)]`}
              >
                {/* Popular Pill if present */}
                {meta.highlightTag && (
                  <div className="absolute -top-3 right-6">
                    <span className="px-3 py-1 rounded-full bg-[#D8A743] text-[#090506] text-[9px] font-black uppercase tracking-widest shadow-md">
                      {meta.highlightTag}
                    </span>
                  </div>
                )}

                {/* Ornamental Top Badge */}
                <div className="mb-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${meta.badgeColor}`}
                  >
                    {meta.badge}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-2xl bg-black/40 border border-[#D8A743]/20">
                      {meta.icon}
                    </div>
                    <span className="text-xs font-black px-3 py-1 rounded-lg bg-black/50 text-[#FFD780] border border-[#D8A743]/25">
                      {cat.attendeesPerTicket} {cat.attendeesPerTicket === 1 ? 'Attendee' : 'Attendees'}
                    </span>
                  </div>

                  <div className="text-left">
                    <h3 className="text-xl font-black text-white hover:text-[#FFD780] transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-[#C8B9B0] mt-1 min-h-[34px] leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  {/* Price Tag */}
                  <div className="pt-3 border-t border-[#D8A743]/20 text-left">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-[#FFD780]">₹{priceInRupees}</span>
                      <span className="text-[11px] text-[#C8B9B0] font-semibold">
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
                      className="w-full py-3.5 rounded-xl bg-black/50 text-[#C8B9B0]/40 text-xs font-black cursor-not-allowed border border-[#D8A743]/10 uppercase"
                    >
                      Sold Out
                    </button>
                  ) : (
                    <Link
                      href={`/checkout?category=${cat.code}`}
                      className="w-full block text-center py-3.5 rounded-xl gold-gradient-btn text-xs font-black tracking-wider uppercase shadow-lg hover:shadow-orange-500/30 transition-all text-[#090506]"
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

      {/* ─────────────────────────────────────────────────────────────
          7. RULES, GUIDELINES & TRUST (#rules)
         ───────────────────────────────────────────────────────────── */}
      <section id="rules" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="p-8 sm:p-10 rounded-3xl bg-[#21080D]/90 border border-[#D8A743]/35 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 text-left">
            <ShieldCheck className="w-7 h-7 text-[#D8A743]" />
            <div>
              <h2 className="font-royal text-2xl font-black text-white tracking-wide uppercase">
                Gate Entry Rules &amp; Ticket Conditions
              </h2>
              <p className="text-xs text-[#FFD780]/80">Official guidelines set by Chaos and Chill</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#FFF1D6]/85 pt-2 text-left">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-black/40 border border-[#D8A743]/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>One Pass Per Booking:</strong> Your QR gate pass covers all attendees in your booking package. Partial arrival is permitted and tracked atomically.
              </span>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-black/40 border border-[#D8A743]/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Limited Capacity:</strong> Entry is strictly controlled for maximum comfort, safety, and a premium arena experience.
              </span>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-black/40 border border-[#D8A743]/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Group Ticket Requirement:</strong> For the Group package (4 people), at least one female attendee is strictly mandatory.
              </span>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-black/40 border border-[#D8A743]/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Non-Refundable Policy:</strong> Tickets once booked are non-refundable and non-transferable except in the event of official cancellation.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. CONTACT, DIRECTIONS & SOCIAL RIBBON (#contact)
         ───────────────────────────────────────────────────────────── */}
      <section id="contact" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 space-y-8 text-center">
        {/* Poster Ribbon Flourish */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#21080D]/90 border-2 border-[#D8A743]/40 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <span className="font-cursive text-3xl sm:text-4xl text-[#FFD780] drop-shadow-md">
              Let&apos;s Dance Together ♡
            </span>
            <p className="text-xs text-[#C8B9B0] font-medium">
              Celebrate Jaipur&apos;s most vibrant Dandiya night with traditional rituals &amp; beats
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="tel:8003022503"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#090506] border border-[#D8A743]/40 hover:border-[#D8A743] transition-colors text-xs font-bold text-white shadow-md"
            >
              <Phone className="w-3.5 h-3.5 text-orange-400" />
              <span>80030 22503</span>
            </a>
            <a
              href="tel:8278695419"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#090506] border border-[#D8A743]/40 hover:border-[#D8A743] transition-colors text-xs font-bold text-white shadow-md"
            >
              <Phone className="w-3.5 h-3.5 text-orange-400" />
              <span>82786 95419</span>
            </a>
            <a
              href="https://instagram.com/_chaos_and_chill_"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#090506] border border-pink-500/50 hover:border-pink-400 transition-colors text-xs font-bold text-pink-300 shadow-md"
            >
              <Instagram className="w-3.5 h-3.5 text-pink-400" />
              <span>@_chaos_and_chill_</span>
            </a>
          </div>
        </div>

        {/* Directions & Support text */}
        <div className="space-y-2">
          <h2 className="font-royal text-2xl sm:text-3xl font-black gold-gradient-text uppercase">
            Need Directions or Have Questions?
          </h2>
          <p className="text-xs sm:text-sm text-[#C8B9B0]">
            Khelcity Multi-Sports Arena, Shivam Nagar, Jagatpura, Jaipur, Rajasthan
          </p>
        </div>
      </section>
    </div>
  );
}
