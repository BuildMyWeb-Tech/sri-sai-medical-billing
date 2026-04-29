// app/store/manage-product/page.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Pencil,
  Trash2,
  PackageOpen,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Layers,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';

// ── Inline variant price editor ───────────────────────────────────
function VariantPriceEdit({ variant, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(variant.price);
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    const num = Number(val);
    if (!num || num <= 0) { toast.error('Enter a valid price'); return; }
    if (num === variant.price) { setEditing(false); return; }
    setSaving(true);
    await onSave(variant.id, { price: num });
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-slate-400 text-sm">₹</span>
        <input
          type="number" min="0" autoFocus value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-20 px-2 py-1 text-sm border border-indigo-400 rounded-md outline-none ring-2 ring-indigo-100 bg-white"
        />
        <button onClick={save} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        </button>
        <button onClick={() => { setVal(variant.price); setEditing(false); }} className="p-1 text-red-400 hover:bg-red-50 rounded">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-sm font-semibold text-green-700 hover:underline hover:text-green-800 transition-colors">
      ₹{Number(variant.price).toLocaleString('en-IN')}
    </button>
  );
}

// ── Inline variant stock editor ───────────────────────────────────
function VariantStockEdit({ variant, lowStockThreshold, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(variant.stock);
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    const num = Math.max(0, Number(val));
    if (num === variant.stock) { setEditing(false); return; }
    setSaving(true);
    await onSave(variant.id, { stock: num });
    setSaving(false);
    setEditing(false);
  };

  const isLow = val > 0 && val < lowStockThreshold;
  const isOut = val === 0;

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number" min="0" autoFocus value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-16 px-2 py-1 text-sm border border-indigo-400 rounded-md outline-none ring-2 ring-indigo-100 bg-white"
        />
        <button onClick={save} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        </button>
        <button onClick={() => { setVal(variant.stock); setEditing(false); }} className="p-1 text-red-400 hover:bg-red-50 rounded">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setEditing(true)}
        className={`text-sm font-semibold hover:underline transition-colors ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-700'}`}
      >
        {val}
      </button>
      {isOut && <AlertCircle size={12} className="text-red-500" title="Out of stock" />}
      {isLow && <AlertCircle size={12} className="text-amber-500" title="Low stock" />}
    </div>
  );
}

// ── Product row ───────────────────────────────────────────────────
function ProductRow({ product, onDelete, onVariantUpdate, lowStockThreshold }) {
  const [expanded, setExpanded] = useState(false);
  const [variants, setVariants] = useState(product.variants || []);
  const { getToken } = useAuth();
  const router = useRouter();

  const handleVariantSave = async (variantId, updates) => {
    try {
      const token = await getToken();
      const { data } = await axios.patch(`/api/store/product/variant?id=${variantId}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVariants((prev) => prev.map((v) => (v.id === variantId ? { ...v, ...data.variant } : v)));
      onVariantUpdate(product.id, data.variant);
      toast.success('Variant updated');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update variant');
    }
  };

  const totalStock  = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  const hasLowStock = variants.some((v) => v.stock > 0 && v.stock < lowStockThreshold);
  const hasOutOfStock = variants.some((v) => v.stock === 0);

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            {product.images?.[0] && (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0">
                <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
              </div>
            )}
            <div>
              <span className="font-medium text-slate-800 line-clamp-1 max-w-[140px] block">{product.name}</span>
              {variants.length > 0 && (
                <span className="text-xs text-slate-400">{variants.length} variant{variants.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </td>

        <td className="px-5 py-4 text-slate-500 text-sm">₹{product.mrp.toLocaleString('en-IN')}</td>

        <td className="px-5 py-4">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-semibold ${totalStock === 0 ? 'text-red-600' : hasLowStock ? 'text-amber-600' : 'text-slate-700'}`}>
              {totalStock}
            </span>
            {hasOutOfStock && <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Out</span>}
            {!hasOutOfStock && hasLowStock && <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Low</span>}
          </div>
        </td>

        <td className="px-5 py-4">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${product.inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${product.inStock ? 'bg-green-500' : 'bg-red-500'}`} />
            {product.inStock ? 'Active' : 'Inactive'}
          </span>
        </td>

        <td className="px-5 py-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-xs font-medium transition-colors"
            >
              <Layers size={12} />
              Variants
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <button
              onClick={() => onDelete(product)}
              className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-indigo-50/30">
          <td colSpan={5} className="px-5 py-3">
            {variants.length === 0 ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                <Layers size={14} /> No variants found.
              </div>
            ) : (
              <div className="rounded-lg border border-indigo-100 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-indigo-50 border-b border-indigo-100">
                      <th className="text-left px-4 py-2.5 font-semibold text-indigo-700 text-xs uppercase">Size</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-indigo-700 text-xs uppercase">Price</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-indigo-700 text-xs uppercase">Stock</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-indigo-700 text-xs uppercase hidden sm:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, idx) => (
                      <tr key={v.id} className={`border-b border-slate-50 ${idx === variants.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center justify-center w-9 h-7 bg-indigo-600 text-white rounded-md text-xs font-bold">{v.size}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <VariantPriceEdit variant={v} onSave={handleVariantSave} />
                        </td>
                        <td className="px-4 py-2.5">
                          <VariantStockEdit variant={v} lowStockThreshold={lowStockThreshold} onSave={handleVariantSave} />
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.stock === 0 ? 'bg-red-50 text-red-600' : v.stock < lowStockThreshold ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                            {v.stock === 0 ? 'Out of stock' : v.stock < lowStockThreshold ? 'Low stock' : 'In stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-400">Click price or stock to edit inline.</p>
                  <button
                    onClick={() => router.push(`/store/add-product?id=${product.id}`)}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    <Pencil size={11} /> Edit All Variants
                  </button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Pagination controls ───────────────────────────────────────────
function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = pagination;
  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
      <p className="text-xs text-slate-500">
        Showing {start}–{end} of {total} products
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!pagination.hasPrev}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs text-slate-600 font-medium px-2">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!pagination.hasNext}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ManageProductPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [products, setProducts]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [pagination, setPagination]       = useState(null);
  const [currentPage, setCurrentPage]     = useState(1);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, productId: null, productName: '' });
  const [deleting, setDeleting]           = useState(false);

  // Fetch settings once
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = await getToken();
        const { data } = await axios.get('/api/store/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.settings?.defaultLowStock) setLowStockThreshold(data.settings.defaultLowStock);
      } catch { /* keep default */ }
    };
    fetchSettings();
  }, []);

  const fetchProducts = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await axios.get(`/api/store/product?page=${page}&limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(data.products || []);
      setPagination(data.pagination || null);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchProducts(currentPage); }, [currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVariantUpdate = useCallback((productId, updatedVariant) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const updatedVariants = (p.variants || []).map((v) =>
          v.id === updatedVariant.id ? { ...v, ...updatedVariant } : v
        );
        const totalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
        return { ...p, variants: updatedVariants, inStock: totalStock > 0 };
      })
    );
  }, []);

  const openDeleteConfirm  = (product) => setDeleteConfirm({ open: true, productId: product.id, productName: product.name });
  const closeDeleteConfirm = () => setDeleteConfirm({ open: false, productId: null, productName: '' });

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const token = await getToken();
      await axios.delete(`/api/store/product?id=${deleteConfirm.productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Remove from current page; if page is now empty and not page 1, go back
      setProducts((prev) => {
        const next = prev.filter((p) => p.id !== deleteConfirm.productId);
        if (next.length === 0 && currentPage > 1) {
          setCurrentPage((p) => p - 1);
        }
        return next;
      });
      setPagination((prev) => prev ? { ...prev, total: prev.total - 1 } : prev);
      toast.success('Product deleted');
      closeDeleteConfirm();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const totalProducts = pagination?.total ?? products.length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Manage Products</h1>
            <p className="text-slate-500 mt-1 text-sm">Expand a product to view and edit its size variants</p>
          </div>
          <span className="text-sm text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full">
            {totalProducts} product{totalProducts !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading products...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <PackageOpen size={48} className="mb-3 text-slate-300" />
              <p className="text-lg font-medium">No products yet</p>
              <p className="text-sm mt-1">Add your first product from the Add Product page</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-4 font-medium text-slate-500">Product</th>
                      <th className="text-left px-5 py-4 font-medium text-slate-500">MRP</th>
                      <th className="text-left px-5 py-4 font-medium text-slate-500">Total Stock</th>
                      <th className="text-left px-5 py-4 font-medium text-slate-500">Status</th>
                      <th className="text-left px-5 py-4 font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        onDelete={openDeleteConfirm}
                        onVariantUpdate={handleVariantUpdate}
                        lowStockThreshold={lowStockThreshold}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={pagination} onPageChange={handlePageChange} />
            </>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeDeleteConfirm} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Delete Product</h3>
                <p className="text-slate-500 mt-1 text-sm">
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-slate-700">"{deleteConfirm.productName}"</span>?
                  The product will be hidden but billing history will remain intact.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeDeleteConfirm} disabled={deleting} className="px-4 py-2.5 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-60 transition-colors">
                {deleting ? <><Loader2 size={16} className="animate-spin" /> Deleting...</> : <><Trash2 size={16} /> Yes, Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}