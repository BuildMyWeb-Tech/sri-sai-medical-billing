// app/(public)/cart/page.jsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  ShoppingCart,
  Trash2,
  Heart,
  ArrowRight,
  Plus,
  Minus,
  ChevronLeft,
  CheckCircle,
  ShieldCheck,
  Bookmark,
  AlertTriangle,
  X,
  Gift,
  Tag,
  Package,
  Percent,
  Sparkles,
  TrendingDown,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { removeFromCart, updateCartQuantity } from '@/lib/features/cart/cartSlice';
import { addToWishlist } from '@/lib/features/wishlist/wishlistSlice';
import OrderSummary from '@/components/OrderSummary';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';

const CartPage = () => {
  const cartItems = useSelector((state) => state.cart.items || []);
  const cartTotal = useSelector((state) => state.cart.totalPrice || 0);
  const dispatch = useDispatch();
  const { getToken, isSignedIn } = useAuth();

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [productToRemove, setProductToRemove] = useState(null);

  // ── Live stock data from backend ─────────────────────────────────
  const [stockMap, setStockMap] = useState({}); // { [productId]: availableStock }
  const [stockLoading, setStockLoading] = useState(false);

  // Fetch live stock for all cart items
  const fetchLiveStock = useCallback(async () => {
    if (cartItems.length === 0) return;
    try {
      setStockLoading(true);
      // Re-use the GET /api/cart endpoint which enriches items with live stock
      let headers = {};
      if (isSignedIn) {
        const token = await getToken();
        headers = { Authorization: `Bearer ${token}` };
      }
      const { data } = await axios.get('/api/cart', { headers });
      const map = {};
      (data.items || []).forEach((item) => {
        map[item.id] = item.availableStock ?? item.quantity ?? 0;
      });
      setStockMap(map);

      // Sync down any quantities that now exceed stock
      (data.items || []).forEach((item) => {
        const reduxItem = cartItems.find((c) => c.id === item.id);
        if (reduxItem && item.stockWarning) {
          // Cap in redux
          dispatch(updateCartQuantity({ id: item.id, quantity: item.availableStock }));
          if (item.outOfStock) {
            toast.error(`"${item.name}" is out of stock and was removed from cart`, {
              duration: 4000,
            });
            dispatch(removeFromCart(item.id));
          } else {
            toast(
              `Quantity for "${item.name}" reduced to available stock (${item.availableStock})`,
              {
                icon: '⚠️',
                duration: 4000,
              }
            );
          }
        }
      });
    } catch {
      // Silent — don't block UX
    } finally {
      setStockLoading(false);
    }
  }, [cartItems, isSignedIn, getToken, dispatch]);

  useEffect(() => {
    fetchLiveStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount; user can also click Refresh

  // Fetch available public coupons
  useEffect(() => {
    const fetchPublicCoupons = async () => {
      try {
        setLoadingCoupons(true);
        const { data } = await axios.get('/api/coupons/public');
        setAvailableCoupons(data.coupons || []);
      } catch {
        // Ignore
      } finally {
        setLoadingCoupons(false);
      }
    };
    fetchPublicCoupons();
  }, []);

  // ── Quantity handler with stock cap ──────────────────────────────
  const updateQuantityHandler = (item, newQty) => {
    if (newQty < 1) return;

    const available = stockMap[item.id] ?? item.availableStock ?? Infinity;

    if (newQty > available) {
      toast.error(`Only ${available} in stock`, { icon: '📦', duration: 2500 });
      // Cap at available
      dispatch(updateCartQuantity({ id: item.id, quantity: available }));
      return;
    }
    dispatch(updateCartQuantity({ id: item.id, quantity: newQty }));
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    if (!isSignedIn) {
      toast.error('Please login to apply coupon');
      return;
    }
    try {
      const token = await getToken();
      const { data } = await axios.post(
        '/api/coupon',
        { code: couponCode.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAppliedCoupon(data.coupon);
      toast.success('Coupon applied!', { icon: '🎉' });
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Invalid coupon code', { icon: '⚠️' });
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.success('Coupon removed', { icon: '🗑️' });
  };

  const confirmRemoveFromCart = (product) => {
    setProductToRemove(product);
    setShowConfirmation(true);
  };

  const removeFromCartHandler = (productId) => {
    dispatch(removeFromCart(productId));
    setShowConfirmation(false);
    setProductToRemove(null);
    toast.success('Removed from cart', { icon: '🗑️' });
  };

  const addToWishlistHandler = (product) => {
    dispatch(
      addToWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
        inStock: true,
      })
    );
    toast.success('Added to wishlist', { icon: '❤️' });
  };

  const subtotal = cartTotal;
  const discount = appliedCoupon ? (subtotal * appliedCoupon.discount) / 100 : 0;
  const tax = subtotal * 0.08;
  const totalAmount = subtotal + tax - discount;

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="w-24 h-24 mx-auto mb-6 flex items-center justify-center rounded-full bg-green-50/50">
            <ShoppingCart size={40} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Your cart is empty</h1>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Looks like you haven't added anything yet.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium py-3 px-8 rounded-full transition-all shadow-sm hover:shadow"
          >
            Start Shopping <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Remove Confirmation Dialog */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 text-red-600 rounded-full">
                    <AlertTriangle size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Remove Item</h3>
                </div>
                <button
                  className="text-slate-400 hover:text-slate-600"
                  onClick={() => {
                    setShowConfirmation(false);
                    setProductToRemove(null);
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              {productToRemove && (
                <div className="p-5">
                  <p className="text-slate-600 mb-4">
                    Remove{' '}
                    <span className="font-medium text-slate-800">{productToRemove.name}</span> from
                    cart?
                  </p>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-5">
                    <div className="relative w-12 h-12 flex-shrink-0 bg-white rounded-md overflow-hidden border border-slate-200">
                      <Image
                        src={productToRemove.image || '/placeholder.png'}
                        alt={productToRemove.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-800">{productToRemove.name}</h4>
                      <p className="text-sm text-slate-500">
                        ₹{productToRemove.price.toFixed(2)} × {productToRemove.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                      onClick={() => {
                        setShowConfirmation(false);
                        setProductToRemove(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center justify-center gap-2"
                      onClick={() => removeFromCartHandler(productToRemove.id)}
                    >
                      <Trash2 size={16} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-1 flex items-center gap-3">
              <ShoppingCart size={24} className="text-green-500" />
              My Cart
            </h1>
            <p className="text-slate-500">
              {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in your cart
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Refresh stock button */}
            <button
              onClick={fetchLiveStock}
              disabled={stockLoading}
              className="flex items-center gap-2 text-sm text-slate-500 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              title="Refresh stock availability"
            >
              <RefreshCw size={14} className={stockLoading ? 'animate-spin' : ''} />
              {stockLoading ? 'Checking stock...' : 'Refresh stock'}
            </button>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Continue Shopping
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-4 p-6 border-b border-slate-100 text-sm font-medium text-slate-600 bg-slate-50">
                <div className="col-span-6">Product</div>
                <div className="col-span-2 text-center">Price</div>
                <div className="col-span-2 text-center">Quantity</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              <div className="divide-y divide-slate-100">
                {cartItems.map((item) => {
                  const availableStock = stockMap[item.id] ?? item.availableStock ?? null;
                  const isOutOfStock = availableStock !== null && availableStock === 0;
                  const isLowStock =
                    availableStock !== null && availableStock > 0 && availableStock < 5;
                  const atMax = availableStock !== null && item.quantity >= availableStock;

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-6 items-center ${isOutOfStock ? 'bg-red-50/40' : ''}`}
                    >
                      {/* Product */}
                      <div className="col-span-6 flex gap-4 items-center">
                        <Link
                          href={`/product/${item.id}`}
                          className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-slate-50 rounded-lg overflow-hidden group/image"
                        >
                          <Image
                            src={item.image || '/placeholder.png'}
                            alt={item.name}
                            fill
                            className="object-contain p-2 transition-transform group-hover/image:scale-110"
                          />
                        </Link>
                        <div>
                          <h3 className="font-medium text-slate-800 mb-1 hover:text-green-600 transition-colors">
                            <Link href={`/product/${item.id}`}>{item.name}</Link>
                          </h3>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                              <Tag size={10} />
                              {item.category}
                            </span>
                            <button
                              onClick={() => addToWishlistHandler(item)}
                              className="text-slate-400 hover:text-red-500 text-xs flex items-center gap-1 transition-colors"
                            >
                              <Heart size={12} />
                              Save for later
                            </button>
                          </div>
                          {/* Stock warnings */}
                          {isOutOfStock && (
                            <span className="mt-1 text-xs text-red-600 flex items-center gap-1">
                              <AlertCircle size={11} /> Out of stock — remove to proceed
                            </span>
                          )}
                          {isLowStock && !isOutOfStock && (
                            <span className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                              <AlertTriangle size={11} /> Only {availableStock} left!
                            </span>
                          )}
                          {atMax && !isOutOfStock && !isLowStock && (
                            <span className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                              <Package size={11} /> Max stock reached ({availableStock})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="col-span-2 md:text-center order-1 md:order-none">
                        <span className="md:hidden text-sm text-slate-500 mr-2">Price: </span>
                        <span className="font-medium text-slate-800">₹{item.price.toFixed(2)}</span>
                      </div>

                      {/* Quantity — with stock cap */}
                      <div className="col-span-2 order-2 md:order-none">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => updateQuantityHandler(item, item.quantity - 1)}
                            disabled={item.quantity <= 1 || isOutOfStock}
                            className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Minus size={16} />
                          </button>
                          <span
                            className={`w-12 text-center font-medium ${isOutOfStock ? 'text-red-500 line-through' : 'text-slate-800'}`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantityHandler(item, item.quantity + 1)}
                            disabled={
                              isOutOfStock ||
                              (availableStock !== null && item.quantity >= availableStock)
                            }
                            className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={atMax ? `Max stock: ${availableStock}` : 'Increase quantity'}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Total & Remove */}
                      <div className="col-span-2 flex justify-between md:justify-end items-center gap-3 order-3 md:order-none">
                        <span className="font-medium text-slate-800">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => confirmRemoveFromCart(item)}
                          className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Coupon Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Gift size={18} className="text-purple-500" />
                Apply Coupon Code
              </h3>

              {appliedCoupon ? (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4"
                >
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500/10 text-green-600 rounded-full p-2">
                        <CheckCircle size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-green-700 flex items-center gap-2">
                          {appliedCoupon.code}
                          <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                            {appliedCoupon.discount}% OFF
                          </span>
                        </p>
                        <p className="text-sm text-green-600">{appliedCoupon.description}</p>
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <TrendingDown size={12} />
                          You saved ₹{discount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-slate-500 hover:text-red-500 transition-colors p-2"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      className="flex-1 p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500 transition-all uppercase"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                    />
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
                      onClick={applyCoupon}
                    >
                      Apply
                    </button>
                  </div>

                  {!loadingCoupons && availableCoupons.length > 0 && (
                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                        <Sparkles size={14} className="text-purple-500" />
                        Available Coupons
                      </p>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {availableCoupons.map((coupon) => (
                          <motion.div
                            key={coupon.code}
                            whileHover={{ scale: 1.01 }}
                            className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-green-300 hover:bg-green-50/30 transition-all cursor-pointer"
                            onClick={() => setCouponCode(coupon.code)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-purple-600 text-sm">
                                  {coupon.code}
                                </span>
                                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Percent size={10} />
                                  {coupon.discount}% OFF
                                </span>
                              </div>
                              <p className="text-xs text-slate-600">{coupon.description}</p>
                              {coupon.forNewUser && (
                                <span className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                  <Sparkles size={10} />
                                  New users only
                                </span>
                              )}
                              {coupon.forMember && (
                                <span className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                                  <ShieldCheck size={10} />
                                  Members only
                                </span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCouponCode(coupon.code);
                                applyCoupon();
                              }}
                              className="text-green-600 hover:text-green-700 font-medium text-sm px-3 py-1 border border-green-200 rounded-md hover:bg-green-50 transition-colors"
                            >
                              Apply
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <OrderSummary
              totalPrice={cartTotal}
              items={cartItems}
              appliedCoupon={appliedCoupon}
              discount={discount}
            />
          </div>
        </div>

        {/* You might also like */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Bookmark size={20} className="text-green-500" />
            You might also like
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-slate-100 relative">
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <Package size={24} />
                  </div>
                </div>
                <div className="p-3">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2 mb-3"></div>
                  <div className="h-6 bg-green-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default CartPage;
