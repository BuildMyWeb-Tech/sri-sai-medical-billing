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
import Link from 'next/link';
import { Calendar, Plus } from 'lucide-react';

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

function ExpiryBadge({ status }) {
 const map = {
  expired:  'bg-red-900/10 text-red-800 border border-red-200',
  critical: 'bg-red-50 text-red-600 border border-red-200',
  soon:     'bg-amber-50 text-amber-600 border border-amber-200',
  ok:       'bg-green-50 text-green-700 border border-green-200',
  none:     'bg-slate-50 text-slate-500 border border-slate-200',
};
  const labels = { expired: '🔴 Expired', critical: '🔴 <7 days', soon: '🟡 <30 days', ok: '🟢 OK', none: '⚪ No Expiry' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${map[status] || map.ok}`}>
      {labels[status] || 'OK'}
    </span>
  );
}

function BatchView({ batches, loading, search, setSearch, onSearch, onEdit, onDelete }) {
    return (
    <div>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by product name or batch number..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearch(search); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300" />
        </div>
        <button onClick={() => onSearch(search)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          Search
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
            <Loader2 size={20} className="animate-spin" /><span>Loading batches...</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Package size={48} className="mb-3 text-slate-300" />
            <p className="text-lg font-medium">No batches found</p>
            <p className="text-sm mt-1">Add stock to see batch entries here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[25%]">Product</th>
<th className="text-left px-3 py-3 font-medium text-slate-500 w-[4%]">Size</th>
<th className="text-left px-3 py-3 font-medium text-slate-500 w-[10%]">Batch No</th>
<th className="text-left px-3 py-3 font-medium text-slate-500 w-[13%]">Expiry</th>
<th className="text-left px-3 py-3 font-medium text-slate-500 w-[10%]">Days</th>
<th className="text-left px-3 py-3 font-medium text-slate-500 w-[3%]">Qty</th>
<th className="text-left px-3 py-3 font-medium text-slate-500 w-[19%]">Status</th>
<th className="text-left px-3 py-3 font-medium text-slate-500 w-[14%]">Action</th>

                </tr>
              </thead>
              <tbody>
                {batches.map((batch, idx) => (
                  <tr key={batch.id}
                    className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${idx === batches.length - 1 ? 'border-b-0' : ''} ${batch.status === 'expired' ? 'bg-red-50/40' : batch.status === 'critical' ? 'bg-red-50/20' : batch.status === 'soon' ? 'bg-amber-50/20' : ''}`}>
                    <td className="px-5 py-4 font-medium text-slate-800">{batch.product?.name}</td>
                    <td className="px-5 py-4">
                      {batch.variant?.size
                        ? <span className="inline-flex items-center justify-center w-10 h-7 bg-indigo-600 text-white rounded-lg text-xs font-bold">{batch.variant.size}</span>
                        : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-600 font-mono text-xs">{batch.batchNumber || '—'}</td>
                 <td className="px-5 py-4 text-slate-600 text-xs">
  {batch.expiryDate
    ? new Date(batch.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : <span className="text-slate-400">—</span>}
</td>
<td className="px-5 py-4">
  {(() => {
    if (!batch.expiryDate) return <span className="text-slate-400 text-xs">—</span>;
    const days = Math.ceil((new Date(batch.expiryDate) - new Date()) / 86400000);
    if (days < 0) return <span className="text-xs font-semibold text-red-800">Expired {Math.abs(days)}d ago</span>;
    if (days <= 7)  return <span className="text-xs font-semibold text-red-600">{days}d</span>;
    if (days <= 15) return <span className="text-xs font-semibold text-orange-600">{days}d</span>;
    if (days <= 30) return <span className="text-xs font-semibold text-amber-600">{days}d</span>;
    return <span className="text-xs font-semibold text-green-600">{days}d</span>;
  })()}
</td>
<td className="px-5 py-4">
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-sm tabular-nums">
    {batch.remainingQty}
  </span>
</td>
<td className="px-5 py-4"><ExpiryBadge status={batch.status} /></td>
<td className="px-5 py-4">
  {batch.remainingQty === batch.quantity ? (
    <div className="flex items-center gap-2">
      <button onClick={() => onEdit(batch)}
        className="text-xs text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors">
        Edit
      </button>
      <button onClick={async () => { onDelete(batch.id); }}
        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
        Delete
      </button>
    </div>
  ) : (
    <span className="text-xs text-slate-300 italic">Partially sold</span>
  )}
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

function EditBatchModal({ batch, onSave, onClose, getToken }) {
  const [form, setForm] = useState({
    expiryDate: batch.expiryDate ? new Date(batch.expiryDate).toISOString().split('T')[0] : '',
    quantity: String(batch.quantity),
    batchNumber: batch.batchNumber || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      await axios.patch(`/api/inventory/batch/${batch.id}`, {
        expiryDate:  form.expiryDate || null,
        quantity:    Number(form.quantity),
        batchNumber: form.batchNumber || null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Batch updated');
      onSave();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Update failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <h3 className="font-bold text-slate-800 text-lg">Edit Batch</h3>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Batch Number</label>
          <input type="text" value={form.batchNumber}
            onChange={(e) => setForm(p => ({ ...p, batchNumber: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Quantity</label>
          <input type="number" min="1" value={form.quantity}
            onChange={(e) => setForm(p => ({ ...p, quantity: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Expiry Date <span className="text-slate-400">(optional)</span></label>
          <input type="date" value={form.expiryDate}
            onChange={(e) => setForm(p => ({ ...p, expiryDate: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function StoreInventoryPage() {
  const { getToken } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [activeView, setActiveView] = useState('stock');   // 'stock' | 'batch'

const [batchSearch, setBatchSearch] = useState('');
const [editingBatch, setEditingBatch] = useState(null);

const batchFetcher = useCallback(async (url) => {
  const token = await getToken();

  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data.batches || [];
}, [getToken]);

const batchSWRKey =
  activeView === 'batch'
    ? `/api/inventory/batches${
        batchSearch ? `?search=${batchSearch}` : ''
      }`
    : null;

const {
  data: batches = [],
  isLoading: batchLoading,
  mutate: mutateBatches,
} = useSWR(batchSWRKey, batchFetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 10000,
});

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

// Refresh both views together
const refreshAll = useCallback(() => {
  mutate();         // inventory overview
  mutateBatches();  // batch cache refresh
}, [mutate, mutateBatches]);

// Auto refresh inventory when batch view active
// Auto refresh inventory + batches every 30 sec
useEffect(() => {
  if (activeView !== 'batch') return;

  const interval = setInterval(() => {
    mutate();
    mutateBatches();
  }, 30000);

  return () => clearInterval(interval);
}, [activeView, mutate, mutateBatches]);

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
  <div className="flex items-center gap-2">
    <Link
      href="/store/inventory/add-stock"
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
    >
      <Plus size={14} /> Add Stock
    </Link>
    <button
      onClick={fetchInventory}
      className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors"
    >
      <RefreshCw size={14} /> Refresh
    </button>
  </div>
</div>

        {/* Summary Cards — skeleton while loading, real data after */}
        {isLoading ? <SummaryCardsSkeleton /> : <SummaryCards inventory={inventory} />}

        {/* Tab switcher */}
<div className="flex items-center gap-2 mb-4">
{[{ key: 'stock', label: 'Stock Overview' }, { key: 'batch', label: '📦 Batch View' }].map(({ key, label }) => (
 <button
  key={key}
  onClick={() => setActiveView(key)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
      {label}
    </button>
  ))}
</div>
{/* STOCK OVERVIEW — only when activeView is stock */}
{activeView === 'stock' && (
  <>
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
<th className="text-left px-5 py-4 font-medium text-slate-500">Action</th>
                    {/* <th className="text-left px-5 py-4 font-medium text-slate-500 hidden md:table-cell">Last Updated</th> */}
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
                      {/* <td className="px-5 py-4 hidden md:table-cell text-slate-400 text-xs">
                        {new Date(inv.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td> */}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
         </>
)}

       {activeView === 'batch' && (
<BatchView
  batches={batches}
  loading={batchLoading}
  search={batchSearch}
  setSearch={setBatchSearch}
  onSearch={() => mutateBatches()}
    onEdit={(batch) => setEditingBatch(batch)}
    onDelete={async (batchId) => {
      if (!confirm('Delete this batch? This cannot be undone.')) return;
      try {
        const token = await getToken();
        await axios.delete(`/api/inventory/batch/${batchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
       toast.success('Batch deleted');
       refreshAll();
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Delete failed');
      }
    }}
  />
)}
        {editingBatch && (
  <EditBatchModal
    batch={editingBatch}
    getToken={getToken}
onSave={() => { setEditingBatch(null); refreshAll(); }}
    onClose={() => setEditingBatch(null)}
  />
)}

      </div>
    </div>
  );
}