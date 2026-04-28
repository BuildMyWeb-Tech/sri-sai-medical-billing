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
  ChevronDown,
  ChevronRight,
  Layers,
  AlertCircle,
} from 'lucide-react';

// ── Expandable variant viewer (read-only) ─────────────────────────
function VariantViewer({ variants, lowStockThreshold }) {
  if (!variants || variants.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
        <Layers size={14} />
        No variants available.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase">
              Size
            </th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase">
              Price
            </th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase">
              Stock
            </th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase hidden sm:table-cell">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v, idx) => {
            const isOut = v.stock === 0;
            const isLow = v.stock > 0 && v.stock < lowStockThreshold;
            return (
              <tr
                key={v.id}
                className={`border-b border-slate-50 ${idx === variants.length - 1 ? 'border-b-0' : ''}`}
              >
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center justify-center w-9 h-7 bg-indigo-600 text-white rounded-md text-xs font-bold">
                    {v.size}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-sm font-semibold text-green-700">
                    ₹{Number(v.price).toLocaleString('en-IN')}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-700'}`}
                    >
                      {v.stock}
                    </span>
                    {isOut && <AlertCircle size={12} className="text-red-500" />}
                    {isLow && <AlertCircle size={12} className="text-amber-500" />}
                  </div>
                </td>
                <td className="px-4 py-2.5 hidden sm:table-cell">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOut ? 'bg-red-50 text-red-600' : isLow ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}
                  >
                    {isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Barcodes are hidden. Contact store owner to update variants.
        </p>
      </div>
    </div>
  );
}

// ── Product row with expandable variants ─────────────────────────
function ProductRow({ product, lowStockThreshold }) {
  const [expanded, setExpanded] = useState(false);
  const variants = product.variants || [];
  const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
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
              <span className="font-medium text-slate-800 line-clamp-1 max-w-[140px] block">
                {product.name}
              </span>
              {variants.length > 0 && (
                <span className="text-xs text-slate-400">
                  {variants.length} variant{variants.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-5 py-4 text-slate-500 text-sm">₹{product.mrp.toLocaleString('en-IN')}</td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-sm font-semibold ${totalStock === 0 ? 'text-red-600' : hasLowStock ? 'text-amber-600' : 'text-slate-700'}`}
            >
              {totalStock}
            </span>
            {hasOutOfStock && (
              <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Out</span>
            )}
            {!hasOutOfStock && hasLowStock && (
              <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                Low
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-4">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${product.inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${product.inStock ? 'bg-green-500' : 'bg-red-500'}`}
            />
            {product.inStock ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-5 py-4">
          <div className="flex flex-wrap gap-1 max-w-[140px]">
            {(product.category || []).slice(0, 2).map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs"
              >
                {cat}
              </span>
            ))}
            {product.category?.length > 2 && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-xs">
                +{product.category.length - 2}
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-4">
          {variants.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-xs font-medium transition-colors"
            >
              <Layers size={12} />
              Sizes
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-indigo-50/20">
          <td colSpan={6} className="px-5 py-3">
            <VariantViewer variants={variants} lowStockThreshold={lowStockThreshold} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function EmployeeManageProductPage() {
  const [employee, setEmployee] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [token, setToken] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageReady, setPageReady] = useState(false);
  const lowStockThreshold = 5;

  useEffect(() => {
    const empData = localStorage.getItem('empData');
    const empToken = localStorage.getItem('empToken');
    if (!empData || !empToken) {
      setLoading(false);
      return;
    }
    const parsed = JSON.parse(empData);
    setEmployee(parsed);
    setToken(empToken);
    const hasAccess =
      parsed.role === 'STORE_OWNER' ||
      parsed.permissions?.manage_product === true ||
      parsed.permissions?.manage_products === true;
    setAllowed(hasAccess);
    setPageReady(true);
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!token || !allowed) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data } = await axios.get('/api/store/product', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(data.products || []);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [token, allowed]);

  useEffect(() => {
    if (pageReady) fetchProducts();
  }, [pageReady, fetchProducts]);

  const displayed = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

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
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Products</h1>
            <p className="text-slate-500 mt-1 text-sm">View all products and their size variants</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full">
              {products.length} product{products.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={fetchProducts}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading products...</span>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <PackageOpen size={48} className="mb-3 text-slate-300" />
              <p className="text-lg font-medium">
                {search ? 'No products found' : 'No products yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Product</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500">MRP</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Total Stock</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Status</th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500 hidden sm:table-cell">
                      Categories
                    </th>
                    <th className="text-left px-5 py-4 font-medium text-slate-500">Sizes</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      lowStockThreshold={lowStockThreshold}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 flex items-center gap-2">
          <PackageOpen size={15} className="text-blue-500 flex-shrink-0" />
          <p>
            Products are <strong>view-only</strong> in the employee portal. Click "Sizes" to view
            variant details. Only store owners can modify products.
          </p>
        </div>
      </div>
    </div>
  );
}
