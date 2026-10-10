'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Shield,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  RefreshCw,
  LogOut,
  Users,
  Search,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface StaffUser {
  id: string;
  username: string;
  name: string;
  role: string;
  gateLocation?: string;
}

interface ScanResultState {
  status: 'SUCCESS' | 'ERROR' | 'IDLE';
  code?: string;
  message?: string;
  bookingRef?: string;
  category?: string;
  customerName?: string;
  admittedNow?: number;
  admittedTotal?: number;
  totalAllowed?: number;
  remaining?: number;
  firstCheckInTime?: string;
}

export default function StaffPortalPage() {
  // Authentication state
  const [username, setUsername] = useState('gate1');
  const [pin, setPin] = useState('');
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [token, setToken] = useState<string>('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [admitCount, setAdmitCount] = useState(1);
  const [audioFeedback, setAudioFeedback] = useState(true);

  // Verification results & shift tracking
  const [processing, setProcessing] = useState(false);
  const [shiftAdmitTotal, setShiftAdmitTotal] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResultState>({ status: 'IDLE' });

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scanLockRef = useRef(false);

  // Play audio tones for fast gate feedback
  const playFeedbackTone = (success: boolean) => {
    if (!audioFeedback || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        // High, upbeat confirmation chime (880Hz -> 1174Hz)
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1174, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        // Low, distinct warning buzz (220Hz)
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}
  };

  // Restore staff session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = sessionStorage.getItem('rit_staff_token');
      if (savedToken) {
        try {
          const res = await fetch('/api/staff/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          const data = await res.json();
          if (res.ok && data.authenticated && data.staff) {
            setStaff(data.staff);
            setToken(savedToken);
          } else {
            sessionStorage.removeItem('rit_staff_token');
          }
        } catch {
          sessionStorage.removeItem('rit_staff_token');
        }
      }
    };
    restoreSession();
  }, []);

  // Staff Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin: pin.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.staff) {
        setStaff(data.staff);
        setToken(data.token);
        sessionStorage.setItem('rit_staff_token', data.token);
        setPin('');
      } else {
        setAuthError(data.error || 'Authentication failed. Please verify credentials.');
      }
    } catch {
      setAuthError('Network error connecting to staff authentication server.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Staff Logout Handler
  const handleLogout = async () => {
    stopScanner();
    try {
      await fetch('/api/staff/logout', { method: 'POST' });
    } catch {}
    sessionStorage.removeItem('rit_staff_token');
    setStaff(null);
    setToken('');
    setScanResult({ status: 'IDLE' });
  };

  // Execute Atomic Check-In
  const executeCheckIn = async (rawToken: string) => {
    if (processing) return;
    setProcessing(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        headers['x-staff-pin'] = '202618';
      }

      const res = await fetch('/api/scanner/check-in', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          token: rawToken.trim(),
          staffId: staff?.id || 'STAFF_GATE_1',
          staffName: staff?.name || 'Gate Officer',
          admitCount,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        playFeedbackTone(true);
        setShiftAdmitTotal((prev) => prev + (data.nowAdmitted || admitCount));
        setScanResult({
          status: 'SUCCESS',
          code: data.resultCode,
          message: data.message,
          bookingRef: data.bookingReference,
          category: data.categoryCode,
          customerName: data.customerName,
          admittedNow: data.nowAdmitted,
          admittedTotal: data.previouslyAdmitted + data.nowAdmitted,
          totalAllowed: data.totalAllowed,
          remaining: data.remaining,
        });
      } else {
        playFeedbackTone(false);
        setScanResult({
          status: 'ERROR',
          code: data.resultCode || data.error || 'INVALID',
          message: data.message || data.error || 'Entry denied',
          bookingRef: data.bookingReference,
          category: data.categoryCode,
          customerName: data.customerName,
          admittedTotal: data.previouslyAdmitted,
          totalAllowed: data.totalAllowed,
          remaining: data.remaining,
          firstCheckInTime: data.firstCheckInTime,
        });
      }
    } catch {
      playFeedbackTone(false);
      setScanResult({
        status: 'ERROR',
        code: 'NETWORK_FAILURE',
        message: 'Network error communicating with check-in server. Failing closed. Do not admit without confirmed server verification.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Manual Lookup Handler
  const handleManualLookup = async () => {
    if (!manualQuery.trim() || processing) return;
    executeCheckIn(manualQuery.trim());
  };

  // Start Camera Scanner
  const startScanner = async () => {
    setCameraError('');
    setIsScanning(true);
    scanLockRef.current = false;

    try {
      const scanner = new Html5Qrcode('staff-qr-reader');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
        },
        async (decodedText) => {
          if (scanLockRef.current) return;
          scanLockRef.current = true;
          try {
            await scanner.stop();
            html5QrCodeRef.current = null;
            setIsScanning(false);
          } catch {}
          executeCheckIn(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      setCameraError(err.message || 'Camera permission denied or camera unavailable in this browser context.');
      setIsScanning(false);
      scanLockRef.current = false;
    }
  };

  // Stop Camera Scanner
  const stopScanner = () => {
    if (html5QrCodeRef.current && isScanning) {
      html5QrCodeRef.current
        .stop()
        .then(() => {
          html5QrCodeRef.current = null;
          setIsScanning(false);
        })
        .catch(() => {
          setIsScanning(false);
        });
    } else {
      setIsScanning(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // 1. DEDICATED STAFF LOGIN SCREEN
  if (!staff) {
    return (
      <div className="min-h-screen bg-[#0D0104] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#1A0307] border border-amber-400/40 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center mx-auto shadow-inner">
            <Shield className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Raas in Taal 2026 • Official Entry Gate
            </span>
            <h1 className="text-2xl font-black text-amber-200 uppercase tracking-wide">
              Staff Portal Login
            </h1>
            <p className="text-xs text-amber-100/70">
              Authorized gate scanning and admission verification.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/60 text-xs font-semibold text-red-200">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-amber-200/90">Gate Officer Account</label>
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl bg-[#0D0104] border border-amber-400/30 text-xs font-semibold text-amber-100 focus:outline-none focus:border-amber-400"
              >
                <option value="gate1">Gate 1 — Officer Vikram</option>
                <option value="gate2">Gate 2 — Officer Ananya</option>
                <option value="supervisor">All Gates — Supervisor</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-amber-200/90">Gate Access PIN</label>
              <input
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 6-digit PIN"
                className="w-full px-4 py-3.5 rounded-xl bg-[#0D0104] border border-amber-400/40 text-center tracking-widest text-lg font-bold text-amber-300 focus:outline-none focus:border-amber-400 shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-[#1A0307] font-black text-xs uppercase tracking-wider shadow-lg disabled:opacity-50 cursor-pointer transition-all"
            >
              {authLoading ? 'Verifying Credentials...' : 'Unlock Gate Scanner'}
            </button>
          </form>

          <p className="text-[10px] text-amber-200/40">
            Khelcity Multi-Sports Arena • Jagatpura, Jaipur
          </p>
        </div>
      </div>
    );
  }

  // 2. AUTHENTICATED STAFF SCANNER INTERFACE
  return (
    <div className="min-h-screen bg-[#0D0104] text-amber-50 flex flex-col">
      {/* Top Gate Bar */}
      <header className="sticky top-0 z-40 bg-[#160206]/95 border-b border-amber-400/30 backdrop-blur-md px-4 py-3 shadow-md">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase text-amber-300 tracking-wider">
                  {staff.name}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Server Connected" />
              </div>
              <span className="text-[9px] text-amber-200/60 block">
                {staff.gateLocation || 'Gate Portal'} • Shift Admissions: {shiftAdmitTotal}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioFeedback(!audioFeedback)}
              className="p-2 rounded-lg bg-[#0D0104] border border-amber-400/20 text-amber-300/80 hover:text-amber-200 text-xs"
              title={audioFeedback ? 'Mute tone' : 'Enable audio tone'}
            >
              {audioFeedback ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-bold hover:bg-red-900 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Scanner Workspace */}
      <main className="flex-1 max-w-xl mx-auto w-full p-4 sm:p-6 space-y-4">
        {/* Attendee Admission Multiplier */}
        <div className="p-3.5 rounded-2xl bg-[#1A0307] border border-amber-400/30 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-100 block">Admit Count This Scan:</span>
            <span className="text-[10px] text-amber-200/60">Choose 1 for single entry, or partial for group</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 4].map((n) => (
              <button
                key={n}
                onClick={() => setAdmitCount(n)}
                className={`w-9 h-9 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  admitCount === n
                    ? 'bg-amber-400 text-[#1A0307] shadow-md scale-105'
                    : 'bg-[#0D0104] border border-amber-400/30 text-amber-200'
                }`}
              >
                +{n}
              </button>
            ))}
          </div>
        </div>

        {/* High-Contrast Result Box */}
        {scanResult.status === 'SUCCESS' && (
          <div className="p-5 rounded-2xl bg-emerald-950 border-2 border-emerald-400 shadow-2xl text-center space-y-2.5 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-emerald-300 tracking-wider">ENTRY ACCEPTED</h2>
            <p className="text-xs font-bold text-white">{scanResult.message}</p>

            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-black/50 text-left text-xs text-white">
              <div>
                <span className="text-white/60 block text-[9.5px]">Category:</span>
                <span className="font-black uppercase text-emerald-300">{scanResult.category}</span>
              </div>
              <div>
                <span className="text-white/60 block text-[9.5px]">Guest Name:</span>
                <span className="font-bold truncate">{scanResult.customerName}</span>
              </div>
              <div>
                <span className="text-white/60 block text-[9.5px]">Admitted Total:</span>
                <span className="font-black text-emerald-300">
                  {scanResult.admittedTotal} of {scanResult.totalAllowed}
                </span>
              </div>
              <div>
                <span className="text-white/60 block text-[9.5px]">Remaining:</span>
                <span className="font-black text-amber-300">{scanResult.remaining} slots</span>
              </div>
            </div>

            <button
              onClick={() => {
                setScanResult({ status: 'IDLE' });
                scanLockRef.current = false;
                startScanner();
              }}
              className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-colors cursor-pointer"
            >
              Scan Next Attendee Pass
            </button>
          </div>
        )}

        {scanResult.status === 'ERROR' && (
          <div className="p-5 rounded-2xl bg-red-950 border-2 border-red-500 shadow-2xl text-center space-y-2.5 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <XCircle className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-red-300 tracking-wider">ENTRY REJECTED</h2>
            <p className="text-xs font-bold text-red-100">{scanResult.message}</p>

            {scanResult.firstCheckInTime && (
              <p className="text-[11px] text-white/80">
                First check-in recorded at: {new Date(scanResult.firstCheckInTime).toLocaleTimeString()}
              </p>
            )}

            {scanResult.bookingRef && (
              <div className="p-2 rounded-lg bg-black/50 text-[11px] text-white/90 font-mono">
                Ref: {scanResult.bookingRef} | Status: {scanResult.code}
              </div>
            )}

            <button
              onClick={() => {
                setScanResult({ status: 'IDLE' });
                scanLockRef.current = false;
                startScanner();
              }}
              className="w-full py-3 rounded-xl bg-red-800 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-colors cursor-pointer"
            >
              Dismiss & Scan Next Pass
            </button>
          </div>
        )}

        {/* Camera Scanner Viewport */}
        <div className="p-5 rounded-3xl bg-[#1A0307] border border-amber-400/30 text-center space-y-3 shadow-xl">
          <div
            id="staff-qr-reader"
            className={`overflow-hidden rounded-2xl bg-black ${isScanning ? 'h-72 w-full' : 'hidden'}`}
          />

          {cameraError && (
            <div className="p-3.5 rounded-xl bg-red-950 border border-red-500/50 text-xs text-red-300 font-medium">
              {cameraError}
            </div>
          )}

          {!isScanning ? (
            <button
              onClick={startScanner}
              disabled={processing}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-[#1A0307] font-black text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              <span>Start Gate Camera Scanner</span>
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="w-full py-3.5 rounded-xl bg-red-900 hover:bg-red-800 text-white font-black text-xs uppercase tracking-wider shadow-md cursor-pointer"
            >
              Stop Camera
            </button>
          )}
        </div>

        {/* Manual Fallback Entry */}
        <div className="p-4 rounded-2xl bg-[#1A0307] border border-amber-400/30 space-y-2.5">
          <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
            Manual Ticket Reference / Pass Token Lookup
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter RIT-2026-XXXXXX or token"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0D0104] border border-amber-400/30 text-xs text-amber-100 font-mono focus:outline-none focus:border-amber-400 uppercase"
            />
            <button
              onClick={handleManualLookup}
              disabled={processing || !manualQuery.trim()}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#1A0307] font-bold text-xs uppercase disabled:opacity-50 cursor-pointer"
            >
              Admit
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
