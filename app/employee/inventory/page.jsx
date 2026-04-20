// app/employee/inventory/page.jsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Image from 'next/image';
import {
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';

function StockBadge({ quantity, lowStock }) {
  if (quantity === 0)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
        <XCircle size={12} /> Out of Stock
      </span>
    );
  if (quantity < lowStock)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
        <AlertTriangle size={12} /> Low Stock
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
      <CheckCircle size={12} /> In Stock
    </span>
  );
}

export default function EmployeeInventoryPage() {
  const [employee, setEmployee] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [token, setToken] = useState(null);

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [pageReady, setPageReady] = useState(false);

  useEffect(() => {
    const empData = localStorage.getItem('empData');
    const empToken = localStorage.getItem('empToken');
    if (!empData || !empToken) { setLoading(false); return; }
    const parsed = JSON.parse(empData);
    setEmployee(parsed);
    setToken(empToken);
    const hasAccess = parsed.role === 'STORE_OWNER' || parsed.permissions?.inventory === true;
    setAllowed(hasAccess);
    setPageReady(true);
  }, []);

  const fetchInventory = useCallback(async () => {
    if (!token || !allowed) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data } = await axios.get('/api/inventory', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInventory(data.inventory || []);
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [token, allowed]);

  useEffect(() => {
    if (pageReady) fetchInventory();
  }, [pageReady, fetchInventory]);

  const displayed = inventory.filter((inv) => {
    const name = inv.product?.name?.toLowerCase() || '';
    const matchSearch = name.includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'out') return inv.quantity === 0;
    if (filter === 'low') return inv.quantity > 0 && inv.quantity < inv.lowStock;
    return true;
  });

  const outCount = inventory.filter((i) => i.quantity === 0).length;
  const lowCount = inventory.filter((i) => i.quantity > 0 && i.quantity < i.lowStock).length;
  const okCount = inventory.filter((i) => i.quantity >= i.lowStock).length;

  if (!pageReady && !loading) return null;

  if (pageReady && !allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={36} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm">You don't have permission to view inventory.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
              <Package size={22} className="text-indigo-600" />
              Inventory
            </h1>
            <p className="text-slate-500 mt-1 text-sm">View stock levels for store products</p>
          </div>
          <button
            onClick={fetchInventory}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">In Stock</p>
            <p className="text-2xl font-bold text-green-600">{okCount}</p>
          </div>
          <div className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Low Stock</p>
            <p className="text-2xl font-bold text-amber-600">{lowCount}</p>
          </div>
          <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Out of Stock</p>
            <p className="text-2xl font-bold text-red-600">{outCount}</p>
          </div>
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
            />
          </div>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'low', label: '⚠ Low' },
              { key: 'out', label: '✕ Out' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading inventory...</span>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Package size={48} className="mb-3 text-slate-300" />
              <p className="text-lg font-medium">No records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Product</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Stock Qty</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500 hidden sm:table-cell">Low Threshold</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Status</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500 hidden md:table-cell">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((inv, idx) => (
                    <tr
                      key={inv.id}
                      className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${
                        inv.quantity === 0
                          ? 'bg-red-50/30'
                          : inv.quantity < inv.lowStock
                          ? 'bg-amber-50/30'
                          : ''
                      } ${idx === displayed.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                        
                          <span className="font-medium text-slate-800 line-clamp-1 max-w-[160px]">
                            {inv.product?.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-slate-700 font-semibold">{inv.quantity}</span>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell text-slate-500">{inv.lowStock}</td>
                      <td className="px-5 py-4">
                        <StockBadge quantity={inv.quantity} lowStock={inv.lowStock} />
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-slate-400 text-xs">
                        {new Date(inv.updatedAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Read-only note */}
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2">
          <Package size={15} className="text-blue-500 flex-shrink-0" />
          <p>Inventory is <strong>view-only</strong> in the employee portal. Contact your store owner to update stock levels.</p>
        </div>
      </div>
    </div>
  );
}