'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  Download,
  Search,
  RefreshCw,
  LogOut,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const loadStats = async (key: string) => {
    setLoading(true);
    setActionMessage('');
    try {
      const res = await fetch('/api/admin/stats', {
        headers: {
          'x-admin-key': key.trim(),
        },
      });

      if (!res.ok) {
        alert('Invalid Admin Secret Key');
        setIsAuthenticated(false);
        sessionStorage.removeItem('rit_admin_key');
        setLoading(false);
        return;
      }

      const resData = await res.json();
      setData(resData);
      setIsAuthenticated(true);
      sessionStorage.setItem('rit_admin_key', key.trim());
    } catch {
      alert('Failed to connect to admin API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedKey = sessionStorage.getItem('rit_admin_key');
    if (savedKey) {
      setAdminKey(savedKey);
      loadStats(savedKey);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKey.trim()) {
      loadStats(adminKey);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('rit_admin_key');
    setIsAuthenticated(false);
    setAdminKey('');
    setData(null);
  };

  const handleRevoke = async (orderId: string) => {
    if (!confirm('Are you sure you want to revoke/refund this ticket booking?')) return;

    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim(),
        },
        body: JSON.stringify({
          action: 'REVOKE_TICKET',
          payload: { orderId, reason: 'REFUNDED' },
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        setActionMessage(resData.message || 'Ticket revoked');
        loadStats(adminKey);
      } else {
        alert(resData.error || 'Failed to revoke ticket');
      }
    } catch {
      alert('Network error executing revoke');
    }
  };

  // CSV Export
  const downloadCSV = () => {
    if (!data || !data.orders) return;
    const headers = ['Order Ref', 'Customer Name', 'Email', 'Phone', 'Category', 'Quantity', 'Attendees', 'Amount (INR)', 'Payment Status', 'Created At'];
    const rows = data.orders.map((o: any) => [
      o.orderReference,
      `"${o.customerName}"`,
      o.customerEmail,
      o.customerPhone,
      o.categoryCode,
      o.quantity,
      o.totalAttendees,
      o.amountPaise / 100,
      o.paymentStatus,
      new Date(o.createdAt).toLocaleString(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `raas_in_taal_bookings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="p-8 rounded-3xl bg-raas-maroon-mid border border-raas-gold/40 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-raas-marigold/20 text-raas-marigold flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold gold-gradient-text uppercase">Admin Security Portal</h1>
            <p className="text-xs text-raas-cream/70">
              Restricted management dashboard for Raas in Taal organizers.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1 text-left">
              <label className="block text-xs font-semibold text-raas-cream/80">Admin Secret Key</label>
              <input
                type="password"
                required
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter ADMIN_SECRET_KEY"
                className="w-full px-4 py-3 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 text-xs text-raas-cream focus:outline-none focus:border-raas-gold"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gold-gradient-btn py-3 rounded-xl text-xs font-extrabold shadow-md cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Access Admin Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const capacity = data?.capacity || {};
  const orders = data?.orders || [];
  const filteredOrders = orders.filter((o: any) => {
    const q = searchQuery.toLowerCase();
    return (
      o.orderReference.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q) ||
      o.customerPhone.includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30">
        <div>
          <span className="text-xs font-bold text-raas-marigold uppercase tracking-wider block">
            Raas in Taal 2026 • Chaos and Chill
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">
            Event Operations & Analytics
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadStats(adminKey)}
            className="p-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 hover:border-raas-gold text-raas-gold cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-raas-maroon-dark border border-raas-gold/30 hover:border-raas-gold text-xs font-bold text-raas-gold"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-950/60 border border-red-500/40 hover:bg-red-900 text-xs font-bold text-red-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950 border border-emerald-500/50 text-xs text-emerald-300 font-bold">
          {actionMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: 500 Capacity */}
        <div className="p-5 rounded-2xl bg-raas-maroon-mid border border-raas-gold/30 space-y-2">
          <div className="flex justify-between items-center text-xs text-raas-cream/70">
            <span>Overall Capacity</span>
            <Users className="w-4 h-4 text-raas-gold" />
          </div>
          <div className="text-2xl font-extrabold text-raas-gold">
            {capacity.allocatedAttendees || 0} / 500
          </div>
          <p className="text-[11px] text-raas-marigold font-medium">
            {capacity.availableAttendees || 0} slots remaining available
          </p>
        </div>

        {/* Card 2: Revenue */}
        <div className="p-5 rounded-2xl bg-raas-maroon-mid border border-raas-gold/30 space-y-2">
          <div className="flex justify-between items-center text-xs text-raas-cream/70">
            <span>Verified Revenue</span>
            <TrendingUp className="w-4 h-4 text-raas-marigold" />
          </div>
          <div className="text-2xl font-extrabold text-raas-cream">
            ₹{((data?.totalSalesPaise || 0) / 100).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-emerald-400 font-medium">
            Confirmed online transactions
          </p>
        </div>

        {/* Card 3: Confirmed Attendees */}
        <div className="p-5 rounded-2xl bg-raas-maroon-mid border border-raas-gold/30 space-y-2">
          <div className="flex justify-between items-center text-xs text-raas-cream/70">
            <span>Confirmed Attendees</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">
            {capacity.confirmedAttendees || 0}
          </div>
          <p className="text-[11px] text-raas-cream/60">
            Issued valid gate passes
          </p>
        </div>

        {/* Card 4: Active Reservations */}
        <div className="p-5 rounded-2xl bg-raas-maroon-mid border border-raas-gold/30 space-y-2">
          <div className="flex justify-between items-center text-xs text-raas-cream/70">
            <span>Active Reservations</span>
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-extrabold text-yellow-400">
            {capacity.reservedAttendees || 0}
          </div>
          <p className="text-[11px] text-raas-cream/60">
            Held in 10-min checkout lock
          </p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="p-6 rounded-3xl bg-raas-maroon-mid border border-raas-gold/30 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-raas-cream">Bookings & Gate Passes</h2>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-raas-cream/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, name, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-raas-maroon-dark border border-raas-gold/20 text-xs text-raas-cream focus:outline-none focus:border-raas-gold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-raas-gold/20 text-raas-cream/60 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Reference</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Attendees</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-raas-gold/10">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-raas-cream/50">
                    No bookings found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o: any) => {
                  const isSuccess = o.paymentStatus === 'SUCCESS';
                  const isRefunded = o.paymentStatus === 'REFUNDED';

                  return (
                    <tr key={o.id} className="hover:bg-raas-maroon-dark/40">
                      <td className="py-3 px-3 font-mono font-bold text-raas-gold">
                        {o.orderReference}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-raas-cream block">{o.customerName}</span>
                        <span className="text-[11px] text-raas-cream/60">{o.customerPhone}</span>
                      </td>
                      <td className="py-3 px-3 uppercase font-semibold text-raas-cream/90">
                        {o.categoryCode}
                      </td>
                      <td className="py-3 px-3 font-bold text-raas-marigold">
                        {o.totalAttendees} Person(s)
                      </td>
                      <td className="py-3 px-3 font-bold text-raas-cream">
                        ₹{o.amountPaise / 100}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isSuccess
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30'
                              : isRefunded
                              ? 'bg-purple-950 text-purple-400 border-purple-500/30'
                              : 'bg-yellow-950 text-yellow-400 border-yellow-500/30'
                          }`}
                        >
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-raas-cream/60 text-[11px]">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isSuccess && (
                          <button
                            onClick={() => handleRevoke(o.id)}
                            className="px-2.5 py-1 rounded-lg bg-red-950 border border-red-500/40 text-[10px] font-bold text-red-300 hover:bg-red-900"
                          >
                            Refund / Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
