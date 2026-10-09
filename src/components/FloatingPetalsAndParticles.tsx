'use client';

import { useEffect, useRef } from 'react';

interface Petal {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  angle: number;
  spinSpeed: number;
  opacity: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  alpha: number;
  alphaChange: number;
}

const PETAL_COLORS = [
  '#F58220', // Marigold bright orange
  '#FFA53B', // Warm amber yellow
  '#E63946', // Rose crimson
  '#D90429', // Deep vermilion
  '#EC4899', // Festive pink
];

export default function FloatingPetalsAndParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Respect user's reduced-motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const isMobile = width < 768;
    const petalCount = isMobile ? 18 : 36;
    const particleCount = isMobile ? 25 : 55;

    const petals: Petal[] = [];
    const particles: Particle[] = [];

    // Initialize Petals
    for (let i = 0; i < petalCount; i++) {
      petals.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 8 + 6,
        speedY: Math.random() * 1.2 + 0.6,
        speedX: Math.sin(Math.random() * Math.PI * 2) * 0.8,
        angle: Math.random() * 360,
        spinSpeed: (Math.random() - 0.5) * 2,
        opacity: Math.random() * 0.6 + 0.35,
        color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
      });
    }

    // Initialize Golden Shimmer Particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.8 + 0.6,
        speedY: -(Math.random() * 0.5 + 0.2), // gentle upwards drift
        speedX: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.8 + 0.2,
        alphaChange: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render & Update Golden Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += p.speedX;
        p.alpha += p.alphaChange;

        if (p.alpha <= 0.1 || p.alpha >= 0.9) {
          p.alphaChange = -p.alphaChange;
        }

        if (p.y < 0) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 199, 104, ${p.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#F5C768';
        ctx.fill();
        ctx.restore();
      }

      // Render & Update Petals
      for (let i = 0; i < petals.length; i++) {
        const petal = petals[i];
        petal.y += petal.speedY;
        petal.x += Math.sin(petal.y * 0.015) * 0.9 + petal.speedX;
        petal.angle += petal.spinSpeed;

        if (petal.y > height + 20) {
          petal.y = -20;
          petal.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(petal.x, petal.y);
        ctx.rotate((petal.angle * Math.PI) / 180);
        ctx.globalAlpha = petal.opacity;

        // Draw curved organic petal
        ctx.beginPath();
        ctx.moveTo(0, -petal.size);
        ctx.bezierCurveTo(
          petal.size * 0.8,
          -petal.size * 0.5,
          petal.size * 0.9,
          petal.size * 0.6,
          0,
          petal.size
        );
        ctx.bezierCurveTo(
          -petal.size * 0.9,
          petal.size * 0.6,
          -petal.size * 0.8,
          -petal.size * 0.5,
          0,
          -petal.size
        );
        ctx.fillStyle = petal.color;
        ctx.fill();

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-20 w-full h-full"
      aria-hidden="true"
    />
  );
}
