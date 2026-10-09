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
} from 'lucide-react';

export default function StaffScannerPage() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [staffName, setStaffName] = useState('Gate Officer 1');

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [admitCount, setAdmitCount] = useState(1);

  // Verification result state
  const [processing, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<{
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
  }>({ status: 'IDLE' });

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() === '202618' || pin.trim().length >= 4) {
      setIsAuthenticated(true);
      sessionStorage.setItem('rit_staff_pin', pin.trim());
    } else {
      alert('Invalid Staff PIN');
    }
  };

  useEffect(() => {
    const savedPin = sessionStorage.getItem('rit_staff_pin');
    if (savedPin) {
      setPin(savedPin);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogout = () => {
    stopScanner();
    sessionStorage.removeItem('rit_staff_pin');
    setIsAuthenticated(false);
    setPin('');
  };

  // Check-in API call
  const executeCheckIn = async (rawToken: string) => {
    if (processing) return;
    setProcessing(true);

    try {
      const res = await fetch('/api/scanner/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-pin': pin.trim(),
        },
        body: JSON.stringify({
          token: rawToken.trim(),
          staffId: 'STAFF_GATE_1',
          staffName,
          admitCount,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
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
    } catch (err: any) {
      setScanResult({
        status: 'ERROR',
        code: 'NETWORK_FAILURE',
        message: 'Network error communicating with check-in server. Failing closed.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Start Camera Scanner
  const startScanner = async () => {
    setCameraError('');
    setIsScanning(true);

    try {
      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Trigger check-in
          executeCheckIn(decodedText);
          stopScanner();
        },
        () => {
          // Scanning frame callback
        }
      );
    } catch (err: any) {
      setCameraError(err.message || 'Camera permission denied or camera not supported.');
      setIsScanning(false);
    }
  };

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

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="p-8 rounded-3xl bg-raas-maroon-mid border border-raas-gold/40 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-raas-gold/20 text-raas-gold flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold gold-gradient-text uppercase">Staff Gate Login</h1>
            <p className="text-xs text-raas-cream/70">
              Authorized entry scanning portal for Raas in Taal 2026.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1 text-left">
              <label className="block text-xs font-semibold text-raas-cream/80">Staff Gate PIN</label>
              <input
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 6-digit PIN (default: 202618)"
                className="w-full px-4 py-3 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-center tracking-widest text-lg font-bold text-raas-gold focus:outline-none focus:border-raas-gold"
              />
            </div>

            <div className="space-y-1 text-left">
              <label className="block text-xs font-semibold text-raas-cream/80">Staff Officer Name</label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream focus:outline-none focus:border-raas-gold"
              />
            </div>

            <button type="submit" className="w-full gold-gradient-btn py-3 rounded-xl text-xs font-extrabold shadow-md">
              Unlock Scanner Access
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Staff Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-raas-maroon-mid border border-raas-gold/30">
        <div>
          <span className="text-[10px] uppercase font-bold text-raas-marigold tracking-wider block">
            Official Gate Officer
          </span>
          <span className="text-sm font-bold text-raas-cream">{staffName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-raas-maroon-dark border border-raas-gold/30 text-xs font-semibold text-raas-cream/70 hover:text-red-400"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Lock Gate</span>
        </button>
      </div>

      {/* Entry Count Selector */}
      <div className="p-4 rounded-2xl bg-raas-maroon-mid border border-raas-gold/30 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-raas-cream block">Admit Attendees In This Scan</span>
          <span className="text-[10px] text-raas-cream/60">Choose 1 for Stag, or partial count for Couple/Group/Family</span>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 4].map((n) => (
            <button
              key={n}
              onClick={() => setAdmitCount(n)}
              className={`w-9 h-9 rounded-lg font-bold text-xs transition-all ${
                admitCount === n
                  ? 'bg-raas-gold text-raas-maroon-deep shadow-md scale-105'
                  : 'bg-raas-maroon-dark border border-raas-gold/30 text-raas-cream'
              }`}
            >
              +{n}
            </button>
          ))}
        </div>
      </div>

      {/* Result Display Box (Clear High Contrast Green / Red) */}
      {scanResult.status === 'SUCCESS' && (
        <div className="p-6 rounded-2xl bg-emerald-950 border-2 border-emerald-500 shadow-xl text-center space-y-3 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-emerald-300 tracking-wider">ENTRY ACCEPTED</h2>
          <p className="text-sm font-bold text-white">{scanResult.message}</p>

          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-black/40 text-left text-xs text-white">
            <div>
              <span className="text-white/60 block text-[10px]">Category:</span>
              <span className="font-bold uppercase text-emerald-300">{scanResult.category}</span>
            </div>
            <div>
              <span className="text-white/60 block text-[10px]">Guest Name:</span>
              <span className="font-bold">{scanResult.customerName}</span>
            </div>
            <div>
              <span className="text-white/60 block text-[10px]">Admitted Total:</span>
              <span className="font-bold text-emerald-300">
                {scanResult.admittedTotal} of {scanResult.totalAllowed}
              </span>
            </div>
            <div>
              <span className="text-white/60 block text-[10px]">Remaining:</span>
              <span className="font-bold text-yellow-300">{scanResult.remaining} slots</span>
            </div>
          </div>
        </div>
      )}

      {scanResult.status === 'ERROR' && (
        <div className="p-6 rounded-2xl bg-red-950 border-2 border-red-500 shadow-xl text-center space-y-3 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <XCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-red-300 tracking-wider">ENTRY REJECTED</h2>
          <p className="text-sm font-bold text-red-200">{scanResult.message}</p>

          {scanResult.firstCheckInTime && (
            <p className="text-xs text-white/80">
              First check-in recorded at: {new Date(scanResult.firstCheckInTime).toLocaleTimeString()}
            </p>
          )}

          {scanResult.bookingRef && (
            <div className="p-2.5 rounded-lg bg-black/40 text-xs text-white/80">
              Ref: {scanResult.bookingRef} | Status: {scanResult.code}
            </div>
          )}
        </div>
      )}

      {/* Camera Scanning Window */}
      <div className="p-6 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 text-center space-y-4">
        <div
          id="qr-reader"
          className={`overflow-hidden rounded-2xl bg-black ${isScanning ? 'h-72' : 'hidden'}`}
        />

        {cameraError && (
          <div className="p-3 rounded-xl bg-red-950 border border-red-500/50 text-xs text-red-300">
            {cameraError}
          </div>
        )}

        {!isScanning ? (
          <button
            onClick={startScanner}
            disabled={processing}
            className="w-full gold-gradient-btn py-4 rounded-xl font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <Camera className="w-5 h-5" />
            <span>Start Gate Camera Scanner</span>
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="w-full py-3.5 rounded-xl bg-red-900 hover:bg-red-800 text-white font-bold text-xs shadow-md"
          >
            Stop Camera Scanner
          </button>
        )}
      </div>

      {/* Manual Token Entry Fallback */}
      <div className="p-5 rounded-2xl bg-raas-maroon-mid border border-raas-gold/30 space-y-3">
        <label className="block text-xs font-bold text-raas-gold uppercase tracking-wider">
          Manual Pass / Token Fallback
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste pass token (e.g. RIT_...)"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream focus:outline-none focus:border-raas-gold font-mono"
          />
          <button
            onClick={() => {
              if (manualToken.trim()) executeCheckIn(manualToken);
            }}
            disabled={processing || !manualToken.trim()}
            className="px-4 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold shrink-0 disabled:opacity-50"
          >
            Verify Pass
          </button>
        </div>
      </div>
    </div>
  );
}
