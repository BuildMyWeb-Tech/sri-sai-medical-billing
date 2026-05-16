// app/store/inventory/add-stock/page.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import {
  Package,
  ArrowLeft,
  Plus,
  Loader2,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';

export default function AddStockPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [products, setProducts]   = useState([]);
 const [loading, setLoading]       = useState(false);
const [fetching, setFetching]     = useState(true);
const [success, setSuccess]       = useState(false);
const [selectedProduct, setSelectedProduct] = useState('');
const [sameExpiry, setSameExpiry] = useState(false);
const [globalExpiry, setGlobalExpiry] = useState('');
const [rows, setRows]             = useState([]);
// rows shape: [{ variantId, size, price, stock, qty: '', expiry: '', batchNumber: '' }]

  // ── Fetch products on mount ───────────────────────────────
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const token = await getToken();
        const { data } = await axios.get('/api/store/products-light', {
  headers: { Authorization: `Bearer ${token}` },
});
setProducts(data.products || []);
      } catch {
        toast.error('Failed to load products');
      } finally {
        setFetching(false);
      }
    };
    fetchProducts();
  }, [getToken]);

  // ── When product changes, load its variants ───────────────
 // Auto-generate batch number helper
const genBatchNum = (idx) => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  // Use timestamp suffix to guarantee uniqueness even for same product/date
  const uniqueSuffix = String(Date.now()).slice(-4);
  return `BAT-${date}-${String(idx+1).padStart(3,'0')}-${uniqueSuffix}`;
};

useEffect(() => {
  if (!selectedProduct) { setRows([]); return; }
  const product = products.find((p) => p.id === selectedProduct);
  const variants = product?.variants || [];
  setRows(variants.map((v, idx) => ({
    variantId:   v.id,
    size:        v.size,
    price:       v.price,
    currentStock: v.stock,
    qty:         '',
    expiry:      '',
    batchNumber: genBatchNum(idx),
  })));
  setSameExpiry(false);
  setGlobalExpiry('');
}, [selectedProduct, products]);

  const updateRow = (idx, field, value) => {
  setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
};

// When sameExpiry checked, fill all rows with globalExpiry
useEffect(() => {
  if (!sameExpiry) return;
  setRows((prev) => prev.map((r) => ({ ...r, expiry: globalExpiry })));
}, [sameExpiry, globalExpiry]);

const handleSubmit = async () => {
  if (loading) return; // ← prevent double submit
  if (!selectedProduct) { toast.error('Please select a product'); return; }
  const validRows = rows.filter((r) => r.qty && Number(r.qty) > 0);
  if (validRows.length === 0) { toast.error('Enter quantity for at least one size'); return; }

  setLoading(true);
  try {
    const token = await getToken();
    // Save all rows with qty > 0 in parallel
   await Promise.all(validRows.map((r) =>
  axios.post('/api/inventory/batch', {
    productId:   selectedProduct,
    variantId:   r.variantId,
    quantity:    Number(r.qty),
    expiryDate:  r.expiry || null,
    batchNumber: r.batchNumber || null,
  }, { headers: { Authorization: `Bearer ${token}` } })
));

 toast.success(`Stock added for ${validRows.length} size(s)!`);
setSuccess(true);
// Reset rows instantly — no page reload
setRows((prev) => prev.map((r, i) => ({
  ...r,
  qty: '',
  batchNumber: genBatchNum(i),
})));
setTimeout(() => setSuccess(false), 1500);
// Auto redirect to inventory after 1.5s
setTimeout(() => router.push('/store/inventory'), 1800);
  } catch (err) {
    toast.error(err?.response?.data?.error || 'Failed to add stock');
  } finally {
    setLoading(false);
  }
};

  

  return (
    <div className="min-h-screen bg-slate-50 p-6">
<div className="max-w-5xl mx-auto">
            {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link href="/store/inventory"
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Inventory
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            <Plus size={22} className="text-indigo-600" />
            Add Stock
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Add a new inventory batch with expiry date
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5">

  {/* Product Search */}
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
      Product <span className="text-red-500">*</span>
    </label>
    {fetching ? (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
        <Loader2 size={14} className="animate-spin" /> Loading products...
      </div>
    ) : (
      <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 bg-white">
        <option value="">— Select Product —</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    )}
  </div>

  {/* Same Expiry For All checkbox */}
  {rows.length > 0 && (
    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
      <input type="checkbox" id="sameExpiry" checked={sameExpiry}
        onChange={(e) => setSameExpiry(e.target.checked)}
        className="w-4 h-4 accent-indigo-600 cursor-pointer" />
      <label htmlFor="sameExpiry" className="text-sm font-medium text-slate-700 cursor-pointer">
        Same Expiry For All Sizes
      </label>
      {sameExpiry && (
        <input type="date" value={globalExpiry}
          onChange={(e) => setGlobalExpiry(e.target.value)}
          className="ml-auto px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
      )}
    </div>
  )}

  {/* Multi-size table */}
  {rows.length > 0 && (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 font-medium text-slate-500">Size</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Current Stock</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Add Qty <span className="text-red-400">*</span></th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Expiry Date</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Batch No</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            // Expiry color warning
            let expiryClass = '';
            if (row.expiry) {
              const days = Math.ceil((new Date(row.expiry) - new Date()) / 86400000);
              if (days < 0)      expiryClass = 'text-red-800 bg-red-100';
              else if (days < 7) expiryClass = 'text-red-600';
              else if (days < 30) expiryClass = 'text-amber-600';
            }
            return (
              <tr key={row.variantId} className={`border-b border-slate-100 last:border-b-0 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center justify-center w-10 h-7 bg-indigo-600 text-white rounded-lg text-xs font-bold">
                    {row.size}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 tabular-nums">{row.currentStock}</td>
                <td className="px-4 py-3">
                  <input type="number" min="1" placeholder="0" value={row.qty}
                    onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                    className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 tabular-nums" />
                </td>
                <td className="px-4 py-3">
                  <input type="date" value={row.expiry}
                    disabled={sameExpiry}
                    onChange={(e) => updateRow(idx, 'expiry', e.target.value)}
                    className={`px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 ${expiryClass}`} />
                </td>
                <td className="px-4 py-3">
                  <input type="text" value={row.batchNumber}
                    onChange={(e) => updateRow(idx, 'batchNumber', e.target.value)}
                    className="w-36 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )}

  {rows.length === 0 && selectedProduct === '' && !fetching && (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-500">
      <Package size={16} className="flex-shrink-0 text-slate-400" />
      Select a product above to see its sizes and add stock.
    </div>
  )}

  {/* Submit */}
  <div className="flex gap-3 pt-2">
    <button onClick={handleSubmit} disabled={loading || success || rows.length === 0}
      className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
        success
          ? 'bg-green-500 text-white'
          : loading
          ? 'bg-indigo-400 text-white cursor-not-allowed'
          : rows.length === 0
          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow'
      }`}>
      {success
        ? <><CheckCircle size={16} /> Stock Added!</>
        : loading
        ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
        : <><Plus size={16} /> Save Stock</>}
    </button>
    <Link href="/store/inventory"
      className="px-5 py-3 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 font-medium text-center">
      Cancel
    </Link>
  </div>
</div>

        {/* Info box */}
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 flex items-start gap-2">
          <Package size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">How this works</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Each stock entry creates a separate batch with its own expiry date.
              During billing, employees select the matching expiry batch from the physical product.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}