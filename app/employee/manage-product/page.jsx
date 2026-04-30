// app/employee/manage-product/page.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Image from 'next/image';
import {
  PackageOpen,
  Loader2,
  ShieldAlert,
  Search,
  X,
  RefreshCw,
  AlertCircle,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

// ── Inline variant viewer (read-only) ─────────────────────────────
function InlineVariants({ variants, lowStockThreshold }) {
  if (!variants || variants.length === 0) {
    return <p className="text-xs text-slate-400 italic mt-1">No variants</p>;
  }
  return (
    <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left px-3 py-1.5 font-semibold text-slate-400 uppercase tracking-wide">Size</th>
            <th className="text-left px-3 py-1.5 font-semibold text-slate-400 uppercase tracking-wide">Price</th>
            <th className="text-left px-3 py-1.5 font-semibold text-slate-400 uppercase tracking-wide">Stock</th>
            {/* <th className="text-left px-3 py-1.5 font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Status</th> */}
          </tr>
        </thead>
        <tbody>
          {variants.map((v, idx) => {
            const isOut = v.stock === 0;
            const isLow = v.stock > 0 && v.stock < lowStockThreshold;
            return (
              <tr key={v.id} className={idx < variants.length - 1 ? 'border-b border-slate-50' : ''}>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-2 bg-indigo-600 text-white rounded text-xs font-bold">
                    {v.size}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs font-semibold text-green-700">₹{Number(v.price).toLocaleString('en-IN')}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-700'}`}>{v.stock}</span>
                    {isOut && <AlertCircle size={10} className="text-red-500" />}
                    {!isOut && isLow && <AlertCircle size={10} className="text-amber-500" />}
                  </div>
                </td>
                {/* <td className="px-3 py-2 hidden sm:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOut ? 'bg-red-50 text-red-600' : isLow ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                    {isOut ? 'Out' : isLow ? 'Low' : 'OK'}
                  </span>
                </td> */}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Product row ───────────────────────────────────────────────────
function ProductRow({ product, lowStockThreshold }) {
  const variants = product.variants || [];
  const totalStock = variants.reduce((s, v) => s + (v.stock || 0), 0);
  const hasLow = variants.some((v) => v.stock > 0 && v.stock < lowStockThreshold);
  const hasOut = variants.some((v) => v.stock === 0);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors align-top">
      <td className="px-5 py-4 min-w-[220px]">
        <div className="flex items-start gap-3">
          {product.images?.[0] && (
            <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0 mt-0.5">
              <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 text-sm line-clamp-1">{product.name}</p>
            {/* <p className="text-xs text-slate-400 mt-0.5">MRP ₹{product.mrp.toLocaleString('en-IN')}</p> */}
            <InlineVariants variants={variants} lowStockThreshold={lowStockThreshold} />
          </div>
        </div>
      </td>

      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start gap-1">
          <span className={`text-sm font-bold ${totalStock === 0 ? 'text-red-600' : hasLow ? 'text-amber-600' : 'text-slate-700'}`}>
            {totalStock}
          </span>
          {hasOut && <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full leading-none">Out of stock</span>}
          {!hasOut && hasLow && <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full leading-none">Low stock</span>}
        </div>
      </td>

      {/* <td className="px-4 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${product.inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${product.inStock ? 'bg-green-500' : 'bg-red-500'}`} />
          {product.inStock ? 'Active' : 'Inactive'}
        </span>
      </td> */}

      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex flex-wrap gap-1 max-w-[140px]">
          {(product.category || []).slice(0, 2).map((cat) => (
            <span key={cat} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">{cat}</span>
          ))}
          {product.category?.length > 2 && (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-xs">+{product.category.length - 2}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────
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

// ── Pagination ────────────────────────────────────────────────────
function Pagination({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const getPages = () => {
    const pages = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
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
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronLeft size={14} />
        </button>
        {getPages().map((p, idx) =>
          p === '...'
            ? <span key={`e${idx}`} className="px-2 text-slate-400 text-sm">…</span>
            : <button key={p} onClick={() => onPageChange(p)} className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium border transition-colors ${p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-white'}`}>{p}</button>
        )}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Default filters ───────────────────────────────────────────────
const DEFAULT_FILTERS = { search: '', stock: 'all', status: 'all', minPrice: '', maxPrice: '', sort: 'newest' };

// ── Main Page ─────────────────────────────────────────────────────
export default function EmployeeManageProductPage() {
  const [employee, setEmployee]   = useState(null);
  const [allowed, setAllowed]     = useState(false);
  const [token, setToken]         = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [pageReady, setPageReady] = useState(false);
  const [filters, setFilters]     = useState(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const lowStockThreshold = 5;
  const LIMIT = 20;

  useEffect(() => {
    const empData  = localStorage.getItem('empData');
    const empToken = localStorage.getItem('empToken');
    if (!empData || !empToken) { setLoading(false); return; }
    const parsed = JSON.parse(empData);
    setEmployee(parsed);
    setToken(empToken);
    setAllowed(parsed.role === 'STORE_OWNER' || parsed.permissions?.manage_product === true || parsed.permissions?.manage_products === true);
    setPageReady(true);
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!token || !allowed) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data } = await axios.get('/api/store/product?limit=500', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllProducts(data.products || []);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  }, [token, allowed]);

  useEffect(() => { if (pageReady) fetchProducts(); }, [pageReady, fetchProducts]);
  useEffect(() => { setCurrentPage(1); }, [filters]);

  const updateFilter = (updates) => setFilters((prev) => ({ ...prev, ...updates }));
  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const hasActive = filters.stock !== 'all' || filters.status !== 'all' || filters.minPrice || filters.maxPrice || filters.sort !== 'newest';

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
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / LIMIT));
  const paginated  = sorted.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  if (!pageReady && loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (pageReady && !allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={36} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm">You don't have permission to view products.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Products</h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              {loading ? 'Loading...' : `${allProducts.length} total product${allProducts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={fetchProducts}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors self-start"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-3 p-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" placeholder="Search by name or size..."
                value={filters.search}
                onChange={(e) => updateFilter({ search: e.target.value })}
                className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 focus:bg-white transition-all"
              />
              {filters.search && (
                <button onClick={() => updateFilter({ search: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="relative">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select value={filters.sort} onChange={(e) => updateFilter({ sort: e.target.value })}
                className="pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <button onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${hasActive ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <SlidersHorizontal size={14} /> Filters {hasActive && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
            </button>
          </div>

          {showFilters && (
            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</label>
                <div className="flex gap-2">
                  {[['all', 'All'], ['low', 'Low Stock'], ['out', 'Out of Stock']].map(([val, label]) => (
                    <button key={val} onClick={() => updateFilter({ stock: val })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filters.stock === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
                <div className="flex gap-2">
                  {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, label]) => (
                    <button key={val} onClick={() => updateFilter({ status: val })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filters.status === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Price Range (₹)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" placeholder="Min" value={filters.minPrice} onChange={(e) => updateFilter({ minPrice: e.target.value })}
                    className="w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-100" />
                  <span className="text-slate-400 text-xs">to</span>
                  <input type="number" min="0" placeholder="Max" value={filters.maxPrice} onChange={(e) => updateFilter({ maxPrice: e.target.value })}
                    className="w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-100" />
                </div>
              </div>
              {hasActive && (
                <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                  <X size={12} /> Reset
                </button>
              )}
              <p className="text-xs text-slate-400 ml-auto self-end">{sorted.length} of {allProducts.length} shown</p>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Product &amp; Variants</th>
                    <th className="text-left px-4 py-4 font-medium text-slate-500">Total Stock</th>
                    {/* <th className="text-left px-4 py-4 font-medium text-slate-500">Status</th> */}
                    {/* <th className="text-left px-4 py-4 font-medium text-slate-500">Categories</th> */}
                  </tr>
                </thead>
                <tbody>{[1,2,3,4,5].map((i) => <SkeletonRow key={i} />)}</tbody>
              </table>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <PackageOpen size={48} className="mb-3 text-slate-300" />
              <p className="text-lg font-medium">{filters.search ? 'No products found' : 'No products yet'}</p>
              {hasActive && <button onClick={resetFilters} className="mt-3 text-sm text-indigo-600 hover:underline">Clear filters</button>}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-4 font-medium text-slate-500">Product &amp; Variants</th>
                      <th className="text-left px-4 py-4 font-medium text-slate-500">Total Stock</th>
                      {/* <th className="text-left px-4 py-4 font-medium text-slate-500">Status</th> */}
                      {/* <th className="text-left px-4 py-4 font-medium text-slate-500">Categories</th> */}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((product) => (
                      <ProductRow key={product.id} product={product} lowStockThreshold={lowStockThreshold} />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={currentPage} totalPages={totalPages} total={sorted.length}
                limit={LIMIT} onPageChange={(p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            </>
          )}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2">
          <PackageOpen size={15} className="text-blue-500 flex-shrink-0" />
          <p>Products are <strong>view-only</strong>. Only store owners can modify products.</p>
        </div>
      </div>
    </div>
  );
}