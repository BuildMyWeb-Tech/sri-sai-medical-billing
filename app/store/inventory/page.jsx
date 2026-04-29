// app/store/inventory/page.jsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import useSWR from 'swr';
import {
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';

// ── Status badge ──────────────────────────────────────────────────
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

// ── Editable threshold cell ───────────────────────────────────────
function EditableThreshold({ inv, onUpdated }) {
  const { getToken } = useAuth();
  const [lowStock, setLowStock] = useState(inv.lowStock);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setLowStock(inv.lowStock); }, [inv.lowStock]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const cancel = () => { setLowStock(inv.lowStock); setEditing(false); };

  const save = async () => {
    if (lowStock === inv.lowStock) { setEditing(false); return; }
    try {
      setSaving(true);
      const token = await getToken();
      const { data } = await axios.post(
        '/api/inventory',
        { productId: inv.productId, lowStock },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onUpdated(inv.productId, data.inventory.lowStock);
      toast.success('Threshold updated');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update');
      setLowStock(inv.lowStock);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-slate-600 hover:text-indigo-600 hover:underline transition-colors tabular-nums" title="Click to edit threshold">
        {lowStock}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef} type="number" min="1" value={lowStock}
        onChange={(e) => setLowStock(Math.max(1, Number(e.target.value)))}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
        className="w-20 h-7 text-center text-sm border border-amber-300 rounded-md ring-2 ring-amber-100 outline-none"
      />
      <button onClick={save} disabled={saving} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1">
        {saving ? <Loader2 size={10} className="animate-spin" /> : null} Save
      </button>
      <button onClick={cancel} className="px-3 py-1 text-slate-500 text-xs border border-slate-200 rounded-md hover:bg-slate-50">
        Cancel
      </button>
    </div>
  );
}

// ── Summary card — only renders after data is loaded ──────────────
function SummaryCards({ inventory }) {
  const outCount = inventory.filter((i) => i.quantity === 0).length;
  const lowCount = inventory.filter((i) => i.quantity > 0 && i.quantity < i.lowStock).length;
  const okCount  = inventory.filter((i) => i.quantity >= i.lowStock).length;

  return (
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
  );
}

// ── Skeleton for summary cards ────────────────────────────────────
function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm animate-pulse">
          <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
          <div className="h-8 w-10 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function StoreInventoryPage() {
  const { getToken } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');

  const fetcher = useCallback(async () => {
    const token = await getToken();
    const { data } = await axios.get('/api/inventory', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.inventory || [];
  }, [getToken]);

  const { data, isLoading, mutate } = useSWR('store-inventory', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval:  30000,
  });

  // Only update state once data has actually arrived — prevents 0-flicker
  useEffect(() => {
    if (data) setInventory(data);
  }, [data]);

  const fetchInventory = useCallback(() => { mutate(); }, [mutate]);

  const handleUpdated = useCallback(
    (productId, newLowStock) => {
      setInventory((prev) =>
        prev.map((inv) => (inv.productId === productId ? { ...inv, lowStock: newLowStock } : inv))
      );
      mutate();
    },
    [mutate]
  );

  const displayed = inventory.filter((inv) => {
    const name       = inv.product?.name?.toLowerCase() || '';
    const matchSearch = name.includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'out') return inv.quantity === 0;
    if (filter === 'low') return inv.quantity > 0 && inv.quantity < inv.lowStock;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
              <Package size={22} className="text-indigo-600" />
              Inventory
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Manage stock levels for your products</p>
          </div>
          <button
            onClick={fetchInventory}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Summary Cards — skeleton while loading, real data after */}
        {isLoading ? <SummaryCardsSkeleton /> : <SummaryCards inventory={inventory} />}

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Search products..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
            />
          </div>
          <div className="flex gap-2">
            {[{ key: 'all', label: 'All' }, { key: 'low', label: '⚠ Low' }, { key: 'out', label: '✕ Out' }].map(({ key, label }) => (
              <button
                key={key} onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {isLoading ? (
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
                      className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${inv.quantity === 0 ? 'bg-red-50/30' : inv.quantity < inv.lowStock ? 'bg-amber-50/30' : ''} ${idx === displayed.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <span className="font-medium text-slate-800 line-clamp-1 max-w-[160px]">{inv.product?.name}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-sm tabular-nums">
                          {inv.quantity}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <EditableThreshold inv={inv} onUpdated={handleUpdated} />
                      </td>
                      <td className="px-5 py-4">
                        <StockBadge quantity={inv.quantity} lowStock={inv.lowStock} />
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-slate-400 text-xs">
                        {new Date(inv.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}