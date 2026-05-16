'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import Link from 'next/link';

import {
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Search,
  Plus,
  Calendar,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   STATUS BADGE
──────────────────────────────────────────── */
function StockBadge({ quantity, lowStock }) {
  if (quantity === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
        <XCircle size={12} /> Out of Stock
      </span>
    );
  }

  if (quantity < lowStock) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
        <AlertTriangle size={12} /> Low Stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
      <CheckCircle size={12} /> In Stock
    </span>
  );
}

/* ─────────────────────────────────────────────
   EDITABLE THRESHOLD
──────────────────────────────────────────── */
function EditableThreshold({ inv, onUpdated }) {
  const { getToken } = useAuth();
  const [lowStock, setLowStock] = useState(inv.lowStock);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => setLowStock(inv.lowStock), [inv.lowStock]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    if (lowStock === inv.lowStock) return setEditing(false);

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
      toast.error('Failed to update');
      setLowStock(inv.lowStock);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="hover:underline text-slate-600"
      >
        {lowStock}
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        type="number"
        value={lowStock}
        min={1}
        onChange={(e) => setLowStock(Number(e.target.value))}
        className="w-20 border rounded px-2 py-1 text-sm"
      />
      <button onClick={save} className="text-xs bg-indigo-600 text-white px-2 rounded">
        {saving ? '...' : 'Save'}
      </button>
      <button onClick={() => setEditing(false)} className="text-xs">
        Cancel
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SUMMARY CARDS
──────────────────────────────────────────── */
function SummaryCards({ inventory }) {
  const out = inventory.filter((i) => i.quantity === 0).length;
  const low = inventory.filter((i) => i.quantity > 0 && i.quantity < i.lowStock).length;
  const ok = inventory.filter((i) => i.quantity >= i.lowStock).length;

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border">
        <p className="text-sm text-slate-500">In Stock</p>
        <p className="text-xl font-bold text-green-600">{ok}</p>
      </div>

      <div className="bg-white p-4 rounded-xl border">
        <p className="text-sm text-slate-500">Low Stock</p>
        <p className="text-xl font-bold text-amber-600">{low}</p>
      </div>

      <div className="bg-white p-4 rounded-xl border">
        <p className="text-sm text-slate-500">Out</p>
        <p className="text-xl font-bold text-red-600">{out}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   EXPIRY BADGE
──────────────────────────────────────────── */
function ExpiryBadge({ status }) {
  const map = {
    expired: 'bg-red-100 text-red-700',
    critical: 'bg-red-50 text-red-600',
    soon: 'bg-amber-50 text-amber-600',
    ok: 'bg-green-50 text-green-700',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs ${map[status] || map.ok}`}>
      {status || 'ok'}
    </span>
  );
}

/* ─────────────────────────────────────────────
   BATCH VIEW
──────────────────────────────────────────── */
function BatchView({ batches, loading, search, setSearch, onSearch }) {
  return (
    <div>
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2 text-slate-400" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch(search)}
            placeholder="Search batches..."
            className="w-full pl-8 border rounded px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={() => onSearch(search)}
          className="bg-indigo-600 text-white px-4 rounded text-sm"
        >
          Search
        </button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">
            Loading batches...
          </div>
        ) : batches.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            No batches found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-left">Batch</th>
                <th className="p-3 text-left">Expiry</th>
                <th className="p-3 text-left">Remaining</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>

            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-3">{b.product?.name}</td>
                  <td className="p-3 font-mono text-xs">
                    {b.batchNumber || '-'}
                  </td>
                  <td className="p-3">
                    {new Date(b.expiryDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="p-3">{b.remainingQty}</td>
                  <td className="p-3">
                    <ExpiryBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
──────────────────────────────────────────── */
export default function StoreInventoryPage() {
  const { getToken } = useAuth();

  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const [activeView, setActiveView] = useState('stock');
  const [batches, setBatches] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');

  /* inventory fetch */
  const fetcher = useCallback(async () => {
    const token = await getToken();
    const { data } = await axios.get('/api/inventory', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.inventory || [];
  }, [getToken]);

  const { data, isLoading, mutate } = useSWR('inventory', fetcher);

  useEffect(() => {
    if (data) setInventory(data);
  }, [data]);

  const fetchInventory = () => mutate();

  /* batch fetch */
  const fetchBatches = useCallback(async (search = batchSearch) => {
    setBatchLoading(true);
    try {
      const token = await getToken();

      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const { data } = await axios.get(
        `/api/inventory/batches?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setBatches(data?.batches || []);
    } catch {
      toast.error('Failed to load batches');
    } finally {
      setBatchLoading(false);
    }
  }, [getToken, batchSearch]);

  const displayed = inventory.filter((i) => {
    const match = i.product?.name?.toLowerCase().includes(search.toLowerCase());
    if (!match) return false;

    if (filter === 'low') return i.quantity < i.lowStock && i.quantity > 0;
    if (filter === 'out') return i.quantity === 0;

    return true;
  });

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package /> Inventory
            </h1>
            <p className="text-slate-500 text-sm">
              Manage stock levels
            </p>
          </div>

          <div className="flex gap-2">
            <Link href="/store/inventory/add-stock" className="bg-indigo-600 text-white px-4 py-2 rounded">
              <Plus size={14} /> Add Stock
            </Link>

            <button onClick={fetchInventory} className="border px-4 py-2 rounded">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* SUMMARY */}
        {isLoading ? <div>Loading...</div> : <SummaryCards inventory={inventory} />}

        {/* TABS */}
        <div className="flex gap-2 mb-4">
          {['stock', 'batch'].map((key) => (
            <button
              key={key}
              onClick={() => {
                setActiveView(key);
                if (key === 'batch') fetchBatches();
              }}
              className={`px-4 py-2 rounded ${
                activeView === key ? 'bg-indigo-600 text-white' : 'bg-white border'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {activeView === 'stock' && (
          <>
            {/* filters */}
            <div className="flex gap-3 mb-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border px-3 py-2 rounded w-full"
                placeholder="Search..."
              />

              {['all', 'low', 'out'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="border px-3 rounded"
                >
                  {f}
                </button>
              ))}
            </div>

            {/* table */}
            <div className="bg-white border rounded-xl overflow-hidden">
              {isLoading ? (
                <div className="p-10 text-center">Loading...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-3 text-left">Product</th>
                      <th className="p-3 text-left">Qty</th>
                      <th className="p-3 text-left">Threshold</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {displayed.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="p-3">{i.product?.name}</td>
                        <td className="p-3">{i.quantity}</td>
                        <td className="p-3">
                          <EditableThreshold inv={i} onUpdated={() => mutate()} />
                        </td>
                        <td className="p-3">
                          <StockBadge quantity={i.quantity} lowStock={i.lowStock} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* BATCH VIEW */}
        {activeView === 'batch' && (
          <BatchView
            batches={batches}
            loading={batchLoading}
            search={batchSearch}
            setSearch={setBatchSearch}
            onSearch={fetchBatches}
          />
        )}
      </div>
    </div>
  );
}