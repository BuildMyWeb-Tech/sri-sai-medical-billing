// app/admin/inventory/page.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Search,
  Store,
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

export default function AdminInventoryPage() {
  const { getToken } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('');

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const url = storeFilter
        ? `/api/inventory?all=true&storeId=${storeFilter}`
        : '/api/inventory?all=true';
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInventory(data.inventory || []);

      // Collect unique stores from response for filter dropdown
      if (!storeFilter) {
        const storeMap = {};
        (data.inventory || []).forEach((inv) => {
          if (inv.store && !storeMap[inv.store.id]) storeMap[inv.store.id] = inv.store;
        });
        setStores(Object.values(storeMap));
      }
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [getToken, storeFilter]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const displayed = inventory.filter((inv) => {
    const name = inv.product?.name?.toLowerCase() || '';
    const storeName = inv.store?.name?.toLowerCase() || '';
    const matchSearch =
      name.includes(search.toLowerCase()) || storeName.includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'out') return inv.quantity === 0;
    if (filter === 'low') return inv.quantity > 0 && inv.quantity < inv.lowStock;
    return true;
  });

  const outCount = inventory.filter((i) => i.quantity === 0).length;
  const lowCount = inventory.filter((i) => i.quantity > 0 && i.quantity < i.lowStock).length;
  const okCount = inventory.filter((i) => i.quantity >= i.lowStock).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck size={22} className="text-green-600" />
              All Stores Inventory
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Monitor stock levels across all vendor stores
            </p>
          </div>
          <button
            onClick={fetchInventory}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-green-100 rounded-xl p-4 shadow-sm">
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product or store..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-green-100 focus:border-green-300"
            />
          </div>

          {/* Store filter */}
          <div className="relative">
            <Store size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="pl-8 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-green-100 appearance-none"
            >
              <option value="">All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
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
                    ? 'bg-green-600 text-white'
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
              <ShieldCheck size={48} className="mb-3 text-slate-300" />
              <p className="text-lg font-medium">No inventory records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Product</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500 hidden sm:table-cell">
                      Store
                    </th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Qty</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500 hidden sm:table-cell">
                      Threshold
                    </th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Status</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500 hidden md:table-cell">
                      Updated
                    </th>
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
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span className="text-slate-500">{inv.store?.name}</span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{inv.quantity}</td>
                      <td className="px-5 py-4 hidden sm:table-cell text-slate-400">
                        {inv.lowStock}
                      </td>
                      <td className="px-5 py-4">
                        <StockBadge quantity={inv.quantity} lowStock={inv.lowStock} />
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-slate-400 text-xs">
                        {new Date(inv.updatedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
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