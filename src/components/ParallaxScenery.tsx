'use client';

import { useEffect, useState } from 'react';

export default function ParallaxScenery() {
  const [scrollY, setScrollY] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    // Check reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    if (mediaQuery.matches) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Parallax offsets
  const palaceOffset = isReducedMotion ? 0 : scrollY * 0.18;
  const dancerOffset = isReducedMotion ? 0 : scrollY * 0.08;
  const garlandOffset = isReducedMotion ? 0 : scrollY * 0.04;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. DEEP BURGUNDY & BLACK-CHERRY RADIAL GRADIENT SKY */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F0205] via-[#1D040A] to-[#0A0103]" />
      
      {/* Ambient glowing night aura over Jaipur palace */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-amber-500/15 via-rose-600/10 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* 2. LAYER A — JAIPUR PALACE / HAVELI SILHOUETTE (Scroll-Linked Parallax) */}
      <div
        className="absolute bottom-0 left-0 right-0 w-full flex justify-center items-end transition-transform ease-out will-change-transform"
        style={{
          transform: `translate3d(0, ${palaceOffset}px, 0)`,
          opacity: 0.85,
        }}
      >
        <svg
          viewBox="0 0 1600 650"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full max-w-[1920px] h-auto drop-shadow-[0_-10px_35px_rgba(245,130,32,0.25)]"
          preserveAspectRatio="xMidYMax slice"
        >
          <defs>
            <linearGradient id="palaceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2E0711" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#1B0309" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#0B0104" stopOpacity="1" />
            </linearGradient>

            <linearGradient id="goldRoofGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFD275" />
              <stop offset="50%" stopColor="#E5A93C" />
              <stop offset="100%" stopColor="#8C5311" />
            </linearGradient>

            <radialGradient id="windowGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF2A3" stopOpacity="1" />
              <stop offset="60%" stopColor="#F58220" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#E5A93C" stopOpacity="0" />
            </radialGradient>

            <filter id="amberGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* PALACE FOUNDATION & TOWERS */}
          <path
            d="M0 650 V460 L120 460 V380 L140 380 V320 L180 320 V250 L220 250 V320 L260 320 V380 L300 380 V440 
               L380 440 V350 L420 350 V280 L460 280 V220 L500 220 V160 L540 160 V220 L580 220 V280 L620 280 V350 L700 350
               V250 L740 250 V180 L780 180 V100 L820 100 V180 L860 180 V250 L900 250
               V350 L980 350 V280 L1020 280 V220 L1060 220 V160 L1100 160 V220 L1140 220 L1180 280 V350 L1220 350 V440
               L1300 440 V380 L1340 380 V320 L1380 320 V250 L1420 250 V320 L1460 320 V380 L1480 380 V460 L1600 460 V650 Z"
            fill="url(#palaceGrad)"
          />

          {/* CENTRAL GRAND CHHATRI DOME (Center: 800) */}
          <path
            d="M750 100 C750 40, 800 15, 800 0 C800 15, 850 40, 850 100 Z"
            fill="url(#goldRoofGrad)"
            filter="url(#amberGlowFilter)"
          />
          {/* Kalash Pinnacle */}
          <path d="M797 0 H803 V-20 H797 Z" fill="#FFE58F" />
          <circle cx="800" cy="-25" r="5" fill="#FFE58F" />

          {/* SIDE CHHATRIS (520 & 1080) */}
          <path d="M485 160 C485 110, 520 80, 520 70 C520 80, 555 110, 555 160 Z" fill="url(#goldRoofGrad)" />
          <path d="M1045 160 C1045 110, 1080 80, 1080 70 C1080 80, 1115 110, 1115 160 Z" fill="url(#goldRoofGrad)" />

          {/* OUTER TOWERS CHHATRIS (200 & 1400) */}
          <path d="M175 250 C175 210, 200 185, 200 180 C200 185, 225 210, 225 250 Z" fill="url(#goldRoofGrad)" />
          <path d="M1375 250 C1375 210, 1400 185, 1400 180 C1400 185, 1425 210, 1425 250 Z" fill="url(#goldRoofGrad)" />

          {/* GLOWING JHAROKHA WINDOWS (Warm illuminated night windows) */}
          {/* Center Windows */}
          <rect x="785" y="120" width="30" height="50" rx="15" fill="url(#windowGlow)" />
          <rect x="760" y="200" width="22" height="36" rx="11" fill="url(#windowGlow)" />
          <rect x="818" y="200" width="22" height="36" rx="11" fill="url(#windowGlow)" />
          <rect x="745" y="270" width="20" height="32" rx="10" fill="url(#windowGlow)" />
          <rect x="790" y="270" width="20" height="32" rx="10" fill="url(#windowGlow)" />
          <rect x="835" y="270" width="20" height="32" rx="10" fill="url(#windowGlow)" />

          {/* Left Wing Windows */}
          <rect x="510" y="180" width="20" height="32" rx="10" fill="url(#windowGlow)" />
          <rect x="440" y="240" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="560" y="240" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="400" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="450" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="590" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="640" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />

          {/* Right Wing Windows */}
          <rect x="1070" y="180" width="20" height="32" rx="10" fill="url(#windowGlow)" />
          <rect x="1000" y="240" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="1120" y="240" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="940" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="990" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="1130" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="1180" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />

          {/* Far Outer Windows */}
          <rect x="190" y="270" width="20" height="30" rx="10" fill="url(#windowGlow)" />
          <rect x="1390" y="270" width="20" height="30" rx="10" fill="url(#windowGlow)" />
          <rect x="130" y="350" width="18" height="26" rx="9" fill="url(#windowGlow)" />
          <rect x="1450" y="350" width="18" height="26" rx="9" fill="url(#windowGlow)" />
        </svg>
      </div>

      {/* 3. LAYER B — TRADITIONAL INDIAN DANDIYA DANCERS (Left: Female, Right: Male) */}
      {/* LEFT DANCER: Female Dandiya Dancer with flaring lehenga and Dandiya sticks */}
      <div
        className="hidden md:block absolute left-2 lg:left-6 top-[18%] w-[260px] lg:w-[340px] pointer-events-none transition-transform duration-700 ease-out will-change-transform z-10"
        style={{
          transform: `translate3d(0, ${dancerOffset}px, 0)`,
        }}
      >
        <div className="animate-dancer-left drop-shadow-[0_15px_30px_rgba(245,130,32,0.35)] opacity-95">
          <svg viewBox="0 0 320 540" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <defs>
              <linearGradient id="skirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EC4899" />
                <stop offset="40%" stopColor="#BE185D" />
                <stop offset="80%" stopColor="#F58220" />
                <stop offset="100%" stopColor="#E5A93C" />
              </linearGradient>
              <linearGradient id="goldCholi" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFD275" />
                <stop offset="100%" stopColor="#E5A93C" />
              </linearGradient>
              <linearGradient id="stickGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFE082" />
                <stop offset="100%" stopColor="#FF6F00" />
              </linearGradient>
            </defs>

            {/* DANDIYA STICK (Left Hand - Striking Angle) */}
            <rect x="190" y="110" width="10" height="150" rx="4" transform="rotate(-35 190 110)" fill="url(#stickGrad1)" stroke="#FFF" strokeWidth="1.5" />
            <circle cx="270" cy="55" r="6" fill="#F58220" />

            {/* DANCER HEAD & ORNATE DUPATTA */}
            {/* Hair Bun / Jooda with flowers */}
            <circle cx="160" cy="95" r="28" fill="#1A0307" />
            <circle cx="178" cy="85" r="8" fill="#F58220" />
            <circle cx="170" cy="78" r="7" fill="#FFF" />
            {/* Face Profile / Crown */}
            <circle cx="155" cy="100" r="20" fill="#FFDFC4" />
            {/* Maang Tikka & Jhumkas */}
            <circle cx="152" cy="86" r="3.5" fill="#FFD275" />
            <circle cx="140" cy="104" r="4.5" fill="#FFD275" />

            {/* DUPATTA (Flowing Veil) */}
            <path
              d="M175 90 C220 120, 260 210, 250 320 C235 240, 205 160, 165 125 Z"
              fill="url(#goldCholi)"
              opacity="0.85"
            />

            {/* CHOLI (Blouse) */}
            <path d="M140 120 C145 140, 140 170, 145 185 H175 C180 170, 175 140, 175 120 Z" fill="url(#goldCholi)" />
            {/* Golden Waistband / Kamarbandh */}
            <rect x="135" y="185" width="45" height="12" rx="3" fill="#FFE082" stroke="#B87B1D" strokeWidth="1" />

            {/* ARMS & BANGLES */}
            {/* Right Arm */}
            <path d="M140 130 Q105 150 110 180" stroke="#FFDFC4" strokeWidth="11" strokeLinecap="round" />
            <rect x="105" y="160" width="8" height="16" fill="#E5A93C" />
            {/* Left Arm raised holding stick */}
            <path d="M175 130 Q210 125 230 100" stroke="#FFDFC4" strokeWidth="11" strokeLinecap="round" />
            <rect x="215" y="105" width="8" height="16" transform="rotate(-30 215 105)" fill="#E5A93C" />

            {/* DANDIYA STICK (Right Hand) */}
            <rect x="95" y="160" width="10" height="145" rx="4" transform="rotate(25 95 160)" fill="url(#stickGrad1)" stroke="#FFF" strokeWidth="1.5" />
            <circle cx="70" cy="275" r="6" fill="#F58220" />

            {/* FLARED CHANIYA CHOLI SKIRT (Dramatic Garba Spin) */}
            <path
              d="M140 195 
                 C110 260, 40 370, 15 470 
                 C100 500, 220 500, 305 470 
                 C275 370, 210 260, 175 195 Z"
              fill="url(#skirtGrad)"
            />

            {/* ORNATE EMBROIDERED SKIRT BORDERS */}
            <path
              d="M20 455 C110 485, 215 485, 300 455 L305 470 C220 500, 100 500, 15 470 Z"
              fill="#FFE082"
            />
            {/* Mirror work circles on skirt */}
            <circle cx="80" cy="420" r="7" fill="#FFF" stroke="#E5A93C" strokeWidth="2" />
            <circle cx="125" cy="435" r="7" fill="#FFF" stroke="#E5A93C" strokeWidth="2" />
            <circle cx="170" cy="440" r="7" fill="#FFF" stroke="#E5A93C" strokeWidth="2" />
            <circle cx="215" cy="435" r="7" fill="#FFF" stroke="#E5A93C" strokeWidth="2" />
            <circle cx="255" cy="420" r="7" fill="#FFF" stroke="#E5A93C" strokeWidth="2" />

            {/* Golden Gota Patti Border Details */}
            <path d="M40 380 Q160 410 280 380" stroke="#FFE082" strokeWidth="4" fill="none" />
            <path d="M60 320 Q160 350 260 320" stroke="#FFE082" strokeWidth="3" fill="none" />
          </svg>
        </div>
      </div>

      {/* RIGHT DANCER: Male Dandiya Dancer with Kedia, turban, and Dandiya sticks */}
      <div
        className="hidden md:block absolute right-2 lg:right-6 top-[18%] w-[260px] lg:w-[340px] pointer-events-none transition-transform duration-700 ease-out will-change-transform z-10"
        style={{
          transform: `translate3d(0, ${dancerOffset}px, 0)`,
        }}
      >
        <div className="animate-dancer-right drop-shadow-[0_15px_30px_rgba(245,130,32,0.35)] opacity-95">
          <svg viewBox="0 0 320 540" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <defs>
              <linearGradient id="kediaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F58220" />
                <stop offset="50%" stopColor="#D90429" />
                <stop offset="100%" stopColor="#9D0208" />
              </linearGradient>
              <linearGradient id="turbanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFE082" />
                <stop offset="50%" stopColor="#F58220" />
                <stop offset="100%" stopColor="#E63946" />
              </linearGradient>
              <linearGradient id="dhotiGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFF9F0" />
                <stop offset="100%" stopColor="#E6D3B3" />
              </linearGradient>
            </defs>

            {/* DANDIYA STICK (Right Hand - Crossed Strike Angle) */}
            <rect x="80" y="80" width="10" height="150" rx="4" transform="rotate(40 80 80)" fill="url(#stickGrad1)" stroke="#FFF" strokeWidth="1.5" />
            <circle cx="35" cy="155" r="6" fill="#F58220" />

            {/* MALE HEAD & TRADITIONAL RAJASTHANI TURBAN (PAGDI) */}
            <circle cx="160" cy="100" r="22" fill="#FFDFC4" />
            {/* Flamboyant Turban */}
            <path
              d="M135 95 C130 65, 160 50, 185 55 C205 60, 205 85, 185 95 Z"
              fill="url(#turbanGrad)"
            />
            {/* Turban plume / brooch (Sarpech) */}
            <circle cx="160" cy="65" r="5" fill="#FFE082" />
            <path d="M160 60 Q165 45 170 40" stroke="#FFE082" strokeWidth="2.5" />

            {/* KEDIA FROCK TOP (Flared Torso) */}
            <path
              d="M135 125 
                 L120 180 
                 L70 270 
                 Q160 300 250 270 
                 L200 180 
                 L185 125 Z"
              fill="url(#kediaGrad)"
            />
            {/* Embroidered Placket & Mirror work */}
            <path d="M160 125 V210" stroke="#FFE082" strokeWidth="4" />
            <circle cx="160" cy="150" r="4" fill="#FFF" />
            <circle cx="160" cy="175" r="4" fill="#FFF" />
            <circle cx="160" cy="200" r="4" fill="#FFF" />

            {/* Kedia Bottom Frill */}
            <path d="M70 270 Q160 300 250 270 L255 285 Q160 315 65 285 Z" fill="#FFE082" />

            {/* ARMS & DANDIYA STICKS */}
            {/* Right Arm extending stick */}
            <path d="M135 135 Q100 130 85 110" stroke="#FFDFC4" strokeWidth="11" strokeLinecap="round" />
            {/* Left Arm raised with second stick */}
            <path d="M185 135 Q220 120 235 90" stroke="#FFDFC4" strokeWidth="11" strokeLinecap="round" />
            {/* Second Dandiya Stick */}
            <rect x="225" y="80" width="10" height="150" rx="4" transform="rotate(-30 225 80)" fill="url(#stickGrad1)" stroke="#FFF" strokeWidth="1.5" />
            <circle cx="285" cy="40" r="6" fill="#F58220" />

            {/* DHOTI / TRADITIONAL PANTS */}
            <path
              d="M120 270 
                 C100 340, 80 430, 95 480 
                 C125 485, 145 420, 155 350 
                 C165 420, 185 485, 215 480 
                 C230 430, 210 340, 190 270 Z"
              fill="url(#dhotiGrad)"
            />
            {/* Dhoti Pleats (Patola/Gold border) */}
            <path d="M155 270 V470" stroke="#E5A93C" strokeWidth="3" />
            <path d="M95 470 H130" stroke="#E5A93C" strokeWidth="3" />
            <path d="M180 470 H215" stroke="#E5A93C" strokeWidth="3" />
          </svg>
        </div>
      </div>

      {/* 4. LAYER C — MARIGOLD GARLANDS (TOP TORAN & SIDE CASCADES) */}
      <div
        className="absolute top-0 left-0 right-0 w-full pointer-events-none z-30 transition-transform duration-500 ease-out"
        style={{ transform: `translate3d(0, ${garlandOffset}px, 0)` }}
      >
        {/* Top Draped Marigold Festoon / Toran */}
        <div className="w-full flex justify-between items-start overflow-hidden h-24 sm:h-28">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={`flex-1 flex flex-col items-center ${
                i % 2 === 0 ? 'animate-garland-swing-1' : 'animate-garland-swing-2'
              }`}
              style={{ animationDelay: `${i * 0.25}s` }}
            >
              {/* String */}
              <div className="w-0.5 h-3 bg-amber-600/70" />
              {/* Marigold cluster */}
              <div className="flex -space-x-1.5">
                <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 shadow-sm shadow-amber-500/50" />
                <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-orange-600 to-orange-400 shadow-sm shadow-orange-500/50" />
              </div>
              <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-300 -mt-1 shadow-sm" />
              <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 -mt-0.5" />
            </div>
          ))}
        </div>

        {/* Left Side Hanging Vertical Marigold String */}
        <div className="absolute top-0 left-2 sm:left-6 flex flex-col items-center animate-garland-swing-1 space-y-1">
          <div className="w-0.5 h-8 bg-amber-600/80" />
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full shadow-md ${
                i % 2 === 0
                  ? 'bg-gradient-to-tr from-orange-600 to-amber-400'
                  : 'bg-gradient-to-tr from-yellow-500 to-amber-300'
              }`}
            />
          ))}
        </div>

        {/* Right Side Hanging Vertical Marigold String */}
        <div className="absolute top-0 right-2 sm:right-6 flex flex-col items-center animate-garland-swing-2 space-y-1">
          <div className="w-0.5 h-8 bg-amber-600/80" />
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full shadow-md ${
                i % 2 === 0
                  ? 'bg-gradient-to-tr from-yellow-500 to-amber-300'
                  : 'bg-gradient-to-tr from-orange-600 to-amber-400'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 5. LAYER D — TRADITIONAL ROYAL HANGING LANTERNS (Kandils / Diya Lamps) */}
      {/* Left Hanging Lantern */}
      <div className="absolute top-12 left-12 sm:left-24 pointer-events-none z-20 animate-lantern-swing">
        {/* Chain */}
        <div className="w-0.5 h-20 sm:h-28 bg-gradient-to-b from-amber-400 to-amber-600 mx-auto" />
        {/* Brass Lantern Body */}
        <div className="relative w-10 sm:w-12 h-14 sm:h-16 rounded-b-xl bg-gradient-to-b from-amber-400 via-amber-600 to-amber-800 border border-amber-300/80 shadow-[0_0_35px_rgba(245,166,35,0.7)] flex items-center justify-center">
          {/* Inner Glowing Candle / Diya */}
          <div className="w-4 h-6 rounded-full bg-gradient-to-t from-orange-500 via-amber-300 to-yellow-100 animate-pulse shadow-[0_0_20px_#FFD275]" />
          {/* Ornamental Cutouts */}
          <div className="absolute inset-x-1.5 inset-y-2 border border-amber-900/60 rounded" />
        </div>
        {/* Hanging Tassel */}
        <div className="w-1.5 h-6 bg-rose-600 mx-auto rounded-b shadow-sm" />
      </div>

      {/* Right Hanging Lantern */}
      <div
        className="absolute top-12 right-12 sm:right-24 pointer-events-none z-20 animate-lantern-swing"
        style={{ animationDelay: '1.2s' }}
      >
        {/* Chain */}
        <div className="w-0.5 h-24 sm:h-32 bg-gradient-to-b from-amber-400 to-amber-600 mx-auto" />
        {/* Brass Lantern Body */}
        <div className="relative w-10 sm:w-12 h-14 sm:h-16 rounded-b-xl bg-gradient-to-b from-amber-400 via-amber-600 to-amber-800 border border-amber-300/80 shadow-[0_0_35px_rgba(245,166,35,0.7)] flex items-center justify-center">
          {/* Inner Glowing Candle / Diya */}
          <div className="w-4 h-6 rounded-full bg-gradient-to-t from-orange-500 via-amber-300 to-yellow-100 animate-pulse shadow-[0_0_20px_#FFD275]" />
          {/* Ornamental Cutouts */}
          <div className="absolute inset-x-1.5 inset-y-2 border border-amber-900/60 rounded" />
        </div>
        {/* Hanging Tassel */}
        <div className="w-1.5 h-6 bg-rose-600 mx-auto rounded-b shadow-sm" />
      </div>

      {/* 6. ORNAMENTAL GOLD ARCHES (Mandala corner accents) */}
      <div className="absolute top-0 left-0 w-36 h-36 bg-[radial-gradient(ellipse_at_top_left,#E5A93C_0%,transparent_70%)] opacity-20 pointer-events-none" />
      <div className="absolute top-0 right-0 w-36 h-36 bg-[radial-gradient(ellipse_at_top_right,#E5A93C_0%,transparent_70%)] opacity-20 pointer-events-none" />
    </div>
  );
}
