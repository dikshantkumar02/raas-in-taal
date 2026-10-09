'use client';

import { useEffect, useState } from 'react';

export default function ParallaxScenery() {
  const [scrollY, setScrollY] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
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
      {/* 1. DEEP BURGUNDY & BLACK-CHERRY SKY WITH AMBIENT NIGHT HAZE */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0104] via-[#1A0309] to-[#080103]" />
      
      {/* Warm Golden Uplighting Atmosphere over Jaipur Palace */}
      <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-amber-500/20 via-orange-600/10 to-transparent rounded-full blur-[140px] pointer-events-none" />

      {/* 2. LAYER A — JAIPUR PALACE / HAVELI SILHOUETTE (Scroll-Linked Parallax) */}
      <div
        className="absolute bottom-0 left-0 right-0 w-full flex justify-center items-end transition-transform ease-out will-change-transform opacity-90"
        style={{
          transform: `translate3d(0, ${palaceOffset}px, 0)`,
        }}
      >
        <svg
          viewBox="0 0 1600 650"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full max-w-[1920px] h-auto drop-shadow-[0_-12px_40px_rgba(245,130,32,0.3)]"
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

          {/* Palace Foundation & Sandstone Towers */}
          <path
            d="M0 650 V460 L120 460 V380 L140 380 V320 L180 320 V250 L220 250 V320 L260 320 V380 L300 380 V440 
               L380 440 V350 L420 350 V280 L460 280 V220 L500 220 V160 L540 160 V220 L580 220 V280 L620 280 V350 L700 350
               V250 L740 250 V180 L780 180 V100 L820 100 V180 L860 180 V250 L900 250
               V350 L980 350 V280 L1020 280 V220 L1060 220 V160 L1100 160 V220 L1140 220 L1180 280 V350 L1220 350 V440
               L1300 440 V380 L1340 380 V320 L1380 320 V250 L1420 250 V320 L1460 320 V380 L1480 380 L1600 460 V650 Z"
            fill="url(#palaceGrad)"
          />

          {/* Central Grand Chhatri Dome */}
          <path
            d="M750 100 C750 40, 800 15, 800 0 C800 15, 850 40, 850 100 Z"
            fill="url(#goldRoofGrad)"
            filter="url(#amberGlowFilter)"
          />
          <path d="M797 0 H803 V-20 H797 Z" fill="#FFE58F" />
          <circle cx="800" cy="-25" r="5" fill="#FFE58F" />

          {/* Side Chhatri Cupolas */}
          <path d="M485 160 C485 110, 520 80, 520 70 C520 80, 555 110, 555 160 Z" fill="url(#goldRoofGrad)" />
          <path d="M1045 160 C1045 110, 1080 80, 1080 70 C1080 80, 1115 110, 1115 160 Z" fill="url(#goldRoofGrad)" />
          <path d="M175 250 C175 210, 200 185, 200 180 C200 185, 225 210, 225 250 Z" fill="url(#goldRoofGrad)" />
          <path d="M1375 250 C1375 210, 1400 185, 1400 180 C1400 185, 1425 210, 1425 250 Z" fill="url(#goldRoofGrad)" />

          {/* Illuminated Jharokha Windows */}
          <rect x="785" y="120" width="30" height="50" rx="15" fill="url(#windowGlow)" />
          <rect x="760" y="200" width="22" height="36" rx="11" fill="url(#windowGlow)" />
          <rect x="818" y="200" width="22" height="36" rx="11" fill="url(#windowGlow)" />
          <rect x="745" y="270" width="20" height="32" rx="10" fill="url(#windowGlow)" />
          <rect x="790" y="270" width="20" height="32" rx="10" fill="url(#windowGlow)" />
          <rect x="835" y="270" width="20" height="32" rx="10" fill="url(#windowGlow)" />

          <rect x="510" y="180" width="20" height="32" rx="10" fill="url(#windowGlow)" />
          <rect x="440" y="240" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="560" y="240" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="400" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="450" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="590" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="640" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />

          <rect x="1070" y="180" width="20" height="32" rx="10" fill="url(#windowGlow)" />
          <rect x="1000" y="240" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="1120" y="240" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="940" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="990" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="1130" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />
          <rect x="1180" y="310" width="18" height="28" rx="9" fill="url(#windowGlow)" />

          <rect x="190" y="270" width="20" height="30" rx="10" fill="url(#windowGlow)" />
          <rect x="1390" y="270" width="20" height="30" rx="10" fill="url(#windowGlow)" />
        </svg>
      </div>

      {/* 3. LAYER B — PHOTOREALISTIC HUMAN DANDIYA DANCERS (FEMALE ON LEFT, MALE ON RIGHT) */}
      
      {/* REALISTIC FEMALE DANCER (LEFT SIDE) */}
      <div
        className="hidden md:block absolute left-[-15px] lg:left-[10px] xl:left-[35px] top-[14%] w-[270px] lg:w-[350px] xl:w-[390px] pointer-events-none transition-transform duration-700 ease-out will-change-transform z-10"
        style={{
          transform: `translate3d(0, ${dancerOffset}px, 0)`,
        }}
      >
        <div className="relative animate-dancer-left filter drop-shadow-[0_15px_35px_rgba(245,130,32,0.45)]">
          {/* Ambient Warm Golden Rim Glow behind dancer */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/25 to-pink-500/20 rounded-full blur-2xl transform scale-90 pointer-events-none" />

          {/* Photorealistic Female Dancer Image with Soft Vignette Mask */}
          <img
            src="/assets/female_dancer.jpg"
            alt="Photorealistic Indian Female Dandiya Dancer in Chaniya Choli"
            className="w-full h-auto object-contain rounded-3xl"
            style={{
              maskImage: 'radial-gradient(ellipse at 50% 50%, black 72%, transparent 98%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, black 72%, transparent 98%)',
            }}
          />
        </div>
      </div>

      {/* REALISTIC MALE DANCER (RIGHT SIDE) */}
      <div
        className="hidden md:block absolute right-[-15px] lg:right-[10px] xl:right-[35px] top-[14%] w-[270px] lg:w-[350px] xl:w-[390px] pointer-events-none transition-transform duration-700 ease-out will-change-transform z-10"
        style={{
          transform: `translate3d(0, ${dancerOffset}px, 0)`,
        }}
      >
        <div className="relative animate-dancer-right filter drop-shadow-[0_15px_35px_rgba(245,130,32,0.45)]">
          {/* Ambient Warm Golden Rim Glow behind dancer */}
          <div className="absolute inset-0 bg-gradient-to-l from-amber-500/25 to-orange-500/20 rounded-full blur-2xl transform scale-90 pointer-events-none" />

          {/* Photorealistic Male Dancer Image with Soft Vignette Mask */}
          <img
            src="/assets/male_dancer.jpg"
            alt="Photorealistic Indian Male Dandiya Dancer in Kediyu and Turban"
            className="w-full h-auto object-contain rounded-3xl"
            style={{
              maskImage: 'radial-gradient(ellipse at 50% 50%, black 72%, transparent 98%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, black 72%, transparent 98%)',
            }}
          />
        </div>
      </div>

      {/* 4. LAYER C — REALISTIC MARIGOLD GARLANDS (TOP TORAN & SIDE CASCADES) */}
      <div
        className="absolute top-0 left-0 right-0 w-full pointer-events-none z-30 transition-transform duration-500 ease-out"
        style={{ transform: `translate3d(0, ${garlandOffset}px, 0)` }}
      >
        {/* Top Photographic Marigold Festoon / Toran */}
        <div className="w-full flex justify-between items-start overflow-hidden h-24 sm:h-32 opacity-95">
          <div
            className="w-full h-28 sm:h-36 bg-repeat-x bg-contain animate-garland-swing-1 drop-shadow-[0_8px_20px_rgba(245,130,32,0.4)]"
            style={{
              backgroundImage: 'url(/assets/marigold_garland.jpg)',
              backgroundSize: '240px auto',
              maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
            }}
          />
        </div>

        {/* Left Side Hanging Real Marigold String */}
        <div className="absolute top-0 left-2 sm:left-6 w-12 sm:w-16 h-80 sm:h-96 animate-garland-swing-1 drop-shadow-lg">
          <div
            className="w-full h-full bg-repeat-y bg-contain"
            style={{
              backgroundImage: 'url(/assets/marigold_garland.jpg)',
              backgroundSize: 'auto 200px',
              maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
            }}
          />
        </div>

        {/* Right Side Hanging Real Marigold String */}
        <div className="absolute top-0 right-2 sm:right-6 w-12 sm:w-16 h-80 sm:h-96 animate-garland-swing-2 drop-shadow-lg">
          <div
            className="w-full h-full bg-repeat-y bg-contain"
            style={{
              backgroundImage: 'url(/assets/marigold_garland.jpg)',
              backgroundSize: 'auto 200px',
              maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
            }}
          />
        </div>
      </div>

      {/* 5. LAYER D — REALISTIC ROYAL BRASS LANTERNS (Kandils / Diya Lamps) */}
      {/* Left Hanging Brass Lantern */}
      <div className="absolute top-8 left-14 sm:left-28 w-20 sm:w-28 pointer-events-none z-20 animate-lantern-swing drop-shadow-[0_0_35px_rgba(245,166,35,0.7)]">
        <img
          src="/assets/brass_lantern.jpg"
          alt="Realistic Indian Royal Brass Hanging Lantern"
          className="w-full h-auto object-contain rounded-2xl"
          style={{
            maskImage: 'radial-gradient(circle at 50% 50%, black 75%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 75%, transparent 100%)',
          }}
        />
      </div>

      {/* Right Hanging Brass Lantern */}
      <div
        className="absolute top-8 right-14 sm:right-28 w-20 sm:w-28 pointer-events-none z-20 animate-lantern-swing drop-shadow-[0_0_35px_rgba(245,166,35,0.7)]"
        style={{ animationDelay: '1.4s' }}
      >
        <img
          src="/assets/brass_lantern.jpg"
          alt="Realistic Indian Royal Brass Hanging Lantern"
          className="w-full h-auto object-contain rounded-2xl"
          style={{
            maskImage: 'radial-gradient(circle at 50% 50%, black 75%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 75%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
}
