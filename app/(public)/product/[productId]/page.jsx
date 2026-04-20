// app/(public)/product/[productId]/page.jsx
'use client';
import ProductDescription from '@/components/ProductDescription';
import ProductDetails from '@/components/ProductDetails';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { Loader2, Home, ChevronRight, AlertTriangle, CheckCircle, Package } from 'lucide-react';

export default function Product() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  // Live stock fetched from backend
  const [liveStock, setLiveStock] = useState(null); // null = not yet fetched
  const [stockLoading, setStockLoading] = useState(false);

  const products = useSelector((state) => state.product.list);

  useEffect(() => {
    scrollTo(0, 0);

    if (products.length > 0) {
      const found = products.find((p) => p.id === productId);
      setProduct(found || null);
      setLoading(false);
    }
  }, [productId, products]);

  // Fetch live stock separately so the product renders fast from Redux
  useEffect(() => {
    if (!productId) return;
    const fetchStock = async () => {
      try {
        setStockLoading(true);
        const res = await fetch(`/api/products?id=${productId}`);
        if (res.ok) {
          const data = await res.json();
          const p = data.product || data.products?.[0];
          if (p) {
            setLiveStock({ quantity: p.quantity ?? 0, inStock: p.inStock ?? false });
          }
        }
      } catch {
        // Fallback to Redux data — no crash
      } finally {
        setStockLoading(false);
      }
    };
    fetchStock();
  }, [productId]);

  const categoryDisplay = product
    ? Array.isArray(product.category)
      ? product.category.join(' + ')
      : product.category
    : '';

  // Use live stock if available, fall back to Redux data
  const stockQty = liveStock !== null ? liveStock.quantity : (product?.quantity ?? 0);
  const isInStock = liveStock !== null ? liveStock.inStock : (product?.inStock ?? false);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 size={22} className="animate-spin" />
          <span>Loading product...</span>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500 gap-3">
        <p className="text-lg font-medium">Product not found</p>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          ← Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-6">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-8 mb-5 flex-wrap">
          <Link href="/" className="flex items-center gap-1 hover:text-slate-700 transition-colors">
            <Home size={14} />
            Home
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <Link href="/shop" className="hover:text-slate-700 transition-colors">
            Products
          </Link>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="text-indigo-600 font-medium">{categoryDisplay}</span>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="text-slate-700 font-medium line-clamp-1 max-w-[200px]">
            {product.name}
          </span>
        </div>

        {/* Live Stock Badge */}
        <div className="mb-4 flex items-center gap-3">
          {stockLoading ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
              <Loader2 size={13} className="animate-spin" /> Checking availability...
            </span>
          ) : isInStock ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100">
              <CheckCircle size={14} />
              In Stock
              {stockQty > 0 && stockQty <= 10 && (
                <span className="ml-1 text-amber-600 font-semibold">— Only {stockQty} left!</span>
              )}
              {stockQty > 10 && <span className="ml-1 text-green-600">({stockQty} available)</span>}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm font-medium border border-red-100">
              <AlertTriangle size={14} /> Out of Stock
            </span>
          )}
        </div>

        {/* Out of Stock Banner */}
        {!isInStock && !stockLoading && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Package size={20} className="text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-red-700">Currently Unavailable</p>
              <p className="text-sm text-red-600 mt-0.5">
                This product is out of stock. Check back later or explore similar products.
              </p>
            </div>
            <Link
              href="/shop"
              className="ml-auto flex-shrink-0 text-sm text-red-600 underline hover:text-red-700"
            >
              Browse more →
            </Link>
          </div>
        )}

        {/* ProductDetails — pass live stock data so it can disable Add to Cart */}
        <ProductDetails
          product={{
            ...product,
            quantity: stockQty,
            inStock: isInStock,
          }}
        />

        {/* Description & Reviews */}
        <ProductDescription product={product} />
      </div>
    </div>
  );
}
