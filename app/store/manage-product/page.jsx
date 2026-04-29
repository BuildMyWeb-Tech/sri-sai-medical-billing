// app/store/manage-product/page.jsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Plus,
  ChevronDown,
} from 'lucide-react';

// ── Inline variant price editor ───────────────────────────────────
function VariantPriceEdit({ variant, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(variant.price);
  const [saving, setSaving] = useState(false);

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
        <span className="text-slate-400 text-xs">₹</span>
        <input
          type="number" min="0" autoFocus value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-20 px-2 py-1 text-xs border border-indigo-400 rounded-md outline-none ring-2 ring-indigo-100 bg-white"
        />
        <button onClick={save} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        </button>
        <button onClick={() => { setVal(variant.price); setEditing(false); }} className="p-1 text-red-400 hover:bg-red-50 rounded">
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-xs font-semibold text-green-700 hover:underline hover:text-green-800 transition-colors">
      ₹{Number(variant.price).toLocaleString('en-IN')}
    </button>
  );
}

// ── Inline variant stock editor ───────────────────────────────────
function VariantStockEdit({ variant, lowStockThreshold, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(variant.stock);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const num = Math.max(0, Number(val));
    if (num === variant.stock) { setEditing(false); return; }
    setSaving(true);
    await onSave(variant.id, { stock: num });
    setSaving(false);
    setEditing(false);
  };

  const isLow = val > 0 && val < lowStockThreshold;
  const isOut = Number(val) === 0;

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number" min="0" autoFocus value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-14 px-2 py-1 text-xs border border-indigo-400 rounded-md outline-none ring-2 ring-indigo-100 bg-white"
        />
        <button onClick={save} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        </button>
        <button onClick={() => { setVal(variant.stock); setEditing(false); }} className="p-1 text-red-400 hover:bg-red-50 rounded">
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setEditing(true)}
        className={`text-xs font-semibold hover:underline transition-colors ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-700'}`}
      >
        {val}
      </button>
      {isOut && <AlertCircle size={10} className="text-red-500" />}
      {!isOut && isLow && <AlertCircle size={10} className="text-amber-500" />}
    </div>
  );
}

// ── Inline variants table (always visible) ────────────────────────
function InlineVariants({ variants, onVariantSave, lowStockThreshold }) {
  if (!variants || variants.length === 0) {
    return <p className="text-xs text-slate-400 italic">No variants</p>;
  }
  return (
    <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left px-3 py-1.5 font-semibold text-slate-400 uppercase tracking-wide">Size</th>
            <th className="text-left px-3 py-1.5 font-semibold text-slate-400 uppercase tracking-wide">Price</th>
            <th className="text-left px-3 py-1.5 font-semibold text-slate-400 uppercase tracking-wide">Stock</th>
            <th className="text-left px-3 py-1.5 font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Status</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v, idx) => (
            <tr key={v.id} className={`${idx < variants.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <td className="px-3 py-2">
                <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-2 bg-indigo-600 text-white rounded text-xs font-bold">
                  {v.size}
                </span>
              </td>
              <td className="px-3 py-2">
                <VariantPriceEdit variant={v} onSave={onVariantSave} />
              </td>
              <td className="px-3 py-2">
                <VariantStockEdit variant={v} lowStockThreshold={lowStockThreshold} onSave={onVariantSave} />
              </td>
              <td className="px-3 py-2 hidden sm:table-cell">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.stock === 0 ? 'bg-red-50 text-red-600' : v.stock < lowStockThreshold ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                  {v.stock === 0 ? 'Out' : v.stock < lowStockThreshold ? 'Low' : 'OK'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Product row (variants always visible inline) ───────────────────
function ProductRow({ product, onDelete, onVariantUpdate, lowStockThreshold, router }) {
  const [variants, setVariants] = useState(product.variants || []);
  const { getToken } = useAuth();

  const handleVariantSave = async (variantId, updates) => {
    try {
      const token = await getToken();
      const { data } = await axios.patch(`/api/store/product/variant?id=${variantId}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVariants((prev) => prev.map((v) => (v.id === variantId ? { ...v, ...data.variant } : v)));
      onVariantUpdate(product.id, data.variant);
      toast.success('Updated');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update');
    }
  };

  const totalStock = variants.reduce((s, v) => s + (v.stock || 0), 0);
  const hasLow = variants.some((v) => v.stock > 0 && v.stock < lowStockThreshold);
  const hasOut = variants.some((v) => v.stock === 0);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors align-top">
      {/* Product */}
      <td className="px-5 py-4 min-w-[200px]">
        <div className="flex items-start gap-3">
          {product.images?.[0] && (
            <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0 mt-0.5">
              <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 text-sm line-clamp-1">{product.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">MRP ₹{product.mrp.toLocaleString('en-IN')}</p>
            {/* Inline variants always shown */}
            <InlineVariants
              variants={variants}
              onVariantSave={handleVariantSave}
              lowStockThreshold={lowStockThreshold}
            />
          </div>
        </div>
      </td>

      {/* Total Stock */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start gap-1">
          <span className={`text-sm font-bold ${totalStock === 0 ? 'text-red-600' : hasLow ? 'text-amber-600' : 'text-slate-700'}`}>
            {totalStock}
          </span>
          {hasOut && <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full leading-none">Out of stock</span>}
          {!hasOut && hasLow && <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full leading-none">Low stock</span>}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${product.inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${product.inStock ? 'bg-green-500' : 'bg-red-500'}`} />
          {product.inStock ? 'Active' : 'Inactive'}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(`/store/add-product?id=${product.id}`)}
            className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            title="Edit product"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete(product)}
            className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete product"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Skeleton loader row ───────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {[1, 2, 3, 4].map((i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
          {i === 1 && <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2 mt-2" />}
        </td>
      ))}
    </tr>
  );
}

// ── Pagination controls ───────────────────────────────────────────
function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  // Build page numbers with ellipsis
  const getPages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50 gap-3">
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700">{start}–{end}</span> of <span className="font-medium text-slate-700">{total}</span> products
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!pagination.hasPrev}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        {getPages().map((p, idx) =>
          p === '...'
            ? <span key={`e${idx}`} className="px-2 text-slate-400 text-sm">…</span>
            : <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium border transition-colors ${p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-white'}`}
              >
                {p}
              </button>
        )}

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

// ── Filter bar ────────────────────────────────────────────────────
function FilterBar({ filters, onChange, onReset, resultCount, totalCount }) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActive = filters.stock !== 'all' || filters.status !== 'all' || filters.minPrice || filters.maxPrice || filters.sort !== 'newest';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-3 p-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or size..."
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 focus:bg-white transition-all"
          />
          {filters.search && (
            <button onClick={() => onChange({ search: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}
            className="pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${hasActive ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <SlidersHorizontal size={14} />
          Filters
          {hasActive && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
        </button>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 flex flex-wrap gap-4 items-end">
          {/* Stock filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</label>
            <div className="flex gap-2">
              {[['all', 'All'], ['low', 'Low Stock'], ['out', 'Out of Stock']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => onChange({ stock: val })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filters.stock === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
            <div className="flex gap-2">
              {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => onChange({ status: val })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filters.status === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Price Range (₹)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => onChange({ minPrice: e.target.value })}
                className="w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="number" min="0" placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => onChange({ maxPrice: e.target.value })}
                className="w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Reset */}
          {hasActive && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <X size={12} /> Reset Filters
            </button>
          )}

          {/* Result count */}
          <p className="text-xs text-slate-400 ml-auto self-end">
            {resultCount} of {totalCount} shown
          </p>
        </div>
      )}
    </div>
  );
}

// ── Default filter state ──────────────────────────────────────────
const DEFAULT_FILTERS = { search: '', stock: 'all', status: 'all', minPrice: '', maxPrice: '', sort: 'newest' };

// ── Main Page ─────────────────────────────────────────────────────
export default function ManageProductPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [allProducts, setAllProducts]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [currentPage, setCurrentPage]   = useState(1);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [filters, setFilters]           = useState(DEFAULT_FILTERS);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, productId: null, productName: '' });
  const [deleting, setDeleting]         = useState(false);
  const LIMIT = 20;

  // Fetch settings
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const { data } = await axios.get('/api/store/settings', { headers: { Authorization: `Bearer ${token}` } });
        if (data.settings?.defaultLowStock) setLowStockThreshold(data.settings.defaultLowStock);
      } catch { /* keep default */ }
    })();
  }, []);

  // Fetch ALL products once (client-side filter/sort/paginate)
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await axios.get('/api/store/product?limit=500', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllProducts(data.products || []);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [filters]);

  const updateFilter = (updates) => setFilters((prev) => ({ ...prev, ...updates }));
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  // Client-side filter + sort
  const filtered = allProducts.filter((p) => {
    const q = filters.search.toLowerCase();
    if (q) {
      const nameMatch = p.name.toLowerCase().includes(q);
      const sizeMatch = (p.variants || []).some((v) => v.size?.toLowerCase().includes(q));
      if (!nameMatch && !sizeMatch) return false;
    }
    const totalStock = (p.variants || []).reduce((s, v) => s + (v.stock || 0), 0);
    const hasLow = (p.variants || []).some((v) => v.stock > 0 && v.stock < lowStockThreshold);
    if (filters.stock === 'out' && totalStock !== 0) return false;
    if (filters.stock === 'low' && !hasLow) return false;
    if (filters.status === 'active' && !p.inStock) return false;
    if (filters.status === 'inactive' && p.inStock) return false;
    if (filters.minPrice && p.mrp < Number(filters.minPrice)) return false;
    if (filters.maxPrice && p.mrp > Number(filters.maxPrice)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (filters.sort === 'az') return a.name.localeCompare(b.name);
    if (filters.sort === 'za') return b.name.localeCompare(a.name);
    if (filters.sort === 'price_asc') return a.mrp - b.mrp;
    if (filters.sort === 'price_desc') return b.mrp - a.mrp;
    if (filters.sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    return new Date(b.createdAt) - new Date(a.createdAt); // newest
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / LIMIT));
  const paginated  = sorted.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);
  const pagination = {
    page: currentPage, totalPages, total: sorted.length, limit: LIMIT,
    hasPrev: currentPage > 1, hasNext: currentPage < totalPages,
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVariantUpdate = useCallback((productId, updatedVariant) => {
    setAllProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const updatedVariants = (p.variants || []).map((v) =>
          v.id === updatedVariant.id ? { ...v, ...updatedVariant } : v
        );
        return { ...p, variants: updatedVariants, inStock: updatedVariants.reduce((s, v) => s + (v.stock || 0), 0) > 0 };
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
      setAllProducts((prev) => prev.filter((p) => p.id !== deleteConfirm.productId));
      toast.success('Product deleted');
      closeDeleteConfirm();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Manage Products</h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              {loading ? 'Loading...' : `${allProducts.length} total product${allProducts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => router.push('/store/add-product')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>

        {/* Filter bar */}
        <FilterBar
          filters={filters}
          onChange={updateFilter}
          onReset={resetFilters}
          resultCount={sorted.length}
          totalCount={allProducts.length}
        />

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Product &amp; Variants</th>
                    <th className="text-left px-4 py-4 font-medium text-slate-500">Total Stock</th>
                    <th className="text-left px-4 py-4 font-medium text-slate-500">Status</th>
                    <th className="text-left px-4 py-4 font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
                </tbody>
              </table>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <PackageOpen size={48} className="mb-3 text-slate-300" />
              <p className="text-lg font-medium">
                {filters.search || filters.stock !== 'all' || filters.status !== 'all' ? 'No products match filters' : 'No products yet'}
              </p>
              {(filters.search || filters.stock !== 'all' || filters.status !== 'all') && (
                <button onClick={resetFilters} className="mt-3 text-sm text-indigo-600 hover:underline">Clear filters</button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-4 font-medium text-slate-500">Product &amp; Variants</th>
                      <th className="text-left px-4 py-4 font-medium text-slate-500">Total Stock</th>
                      <th className="text-left px-4 py-4 font-medium text-slate-500">Status</th>
                      <th className="text-left px-4 py-4 font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        onDelete={openDeleteConfirm}
                        onVariantUpdate={handleVariantUpdate}
                        lowStockThreshold={lowStockThreshold}
                        router={router}
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
                  Billing history will remain intact.
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