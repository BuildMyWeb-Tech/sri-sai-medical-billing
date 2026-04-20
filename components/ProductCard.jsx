// C:\Users\Siddharathan\Desktop\gocart-ecommerce-full-stack\components\ProductCard.jsx
'use client';
import { StarIcon, Tag, CheckCircle, ShoppingCart, Heart, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, removeFromCart } from '@/lib/features/cart/cartSlice';
import { addToWishlist, removeFromWishlist } from '@/lib/features/wishlist/wishlistSlice';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const ProductCard = ({ product, badgeText, badgeIcon }) => {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.items || []);
  const wishlistItems = useSelector((state) => state.wishlist.items || []);
  const isInCart = cartItems.some((item) => item.id === product.id);
  const isInWishlist = wishlistItems.some((item) => item.id === product.id);

  const rating =
    Math.round(
      product.rating?.reduce((acc, curr) => acc + curr.rating, 0) / (product.rating?.length || 1)
    ) || 0;

  const discountPercentage =
    product.mrp && product.price < product.mrp
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  const categoryDisplay = Array.isArray(product.category)
    ? product.category.join(' + ')
    : product.category || '';

  const firstCategory = Array.isArray(product.category)
    ? (product.category[0] || '').toLowerCase()
    : (product.category || '').toLowerCase();

  const getBgClass = () => {
    if (firstCategory.includes('hair')) return 'bg-gradient-to-br from-[#ede0d4] to-[#e6ccb2]';
    if (firstCategory.includes('shampoo')) return 'bg-gradient-to-br from-[#d8f3dc] to-[#b7e4c7]';
    if (firstCategory.includes('dandruff')) return 'bg-gradient-to-br from-[#e9ecef] to-[#dee2e6]';
    if (firstCategory.includes('electronic'))
      return 'bg-gradient-to-br from-[#e0e7ff] to-[#c7d2fe]';
    if (firstCategory.includes('fashion')) return 'bg-gradient-to-br from-[#fce7f3] to-[#fbcfe8]';
    return 'bg-gradient-to-br from-[#dbe7fb] to-[#bfd7fc]';
  };

  useEffect(() => {
    if (isHovering && product.images?.length > 1) {
      const interval = setInterval(() => {
        setActiveImageIndex((prev) => (prev + 1) % product.images.length);
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setActiveImageIndex(0);
    }
  }, [isHovering, product.images?.length]);

  const handleCartAction = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.inStock) return;

    setIsActionInProgress(true);

    if (isInCart) {
      dispatch(removeFromCart(product.id));
      toast.error(`${product.name} removed from cart`, {
        icon: '🛒',
        style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });
    } else {
      dispatch(
        addToCart({
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || '/placeholder.png',
            quantity: 1,
            category: categoryDisplay,
            stock: product.quantity ?? 1,
            storeId: product.storeId, // ✅ FIX: storeId saved into cart
          },
        })
      );
      toast.success(`${product.name} added to cart!`, {
        icon: '🛒',
        style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });
    }

    setTimeout(() => setIsActionInProgress(false), 500);
  };

  const toggleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInWishlist) {
      dispatch(removeFromWishlist(product.id));
      toast.error('Removed from wishlist', {
        icon: '💔',
        style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });
    } else {
      dispatch(
        addToWishlist({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || '/placeholder.png',
          category: categoryDisplay,
          inStock: product.inStock,
        })
      );
      toast.success('Added to wishlist', {
        icon: '❤️',
        style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });
    }
  };

  return (
    <div
      className="group max-xl:mx-auto relative block transform transition-all duration-300 hover:-translate-y-1.5 w-full cursor-pointer"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => router.push(`/product/${product.id}`)}
    >
      <div className="rounded-xl overflow-hidden bg-white border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col">
        {/* Image */}
        <div
          className={`h-48 sm:h-56 w-full flex items-center justify-center overflow-hidden relative ${getBgClass()}`}
        >
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-r from-slate-100 to-slate-200 animate-pulse overflow-hidden">
              <div className="absolute top-0 left-0 right-0 bottom-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          )}
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {product.images?.map((image, index) => (
              <Image
                key={index}
                width={500}
                height={500}
                className={`absolute inset-0 h-full w-full object-contain object-center p-4 transition-opacity duration-500 ${index === activeImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'} ${imageLoaded ? '' : 'opacity-0'}`}
                src={image}
                alt={`${product.name} - ${index + 1}`}
                onLoad={() => {
                  if (index === 0) setImageLoaded(true);
                }}
              />
            ))}
          </div>

          {product.images?.length > 1 && (
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-20">
              {product.images.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${activeImageIndex === index ? 'w-4 bg-slate-800' : 'w-1.5 bg-slate-400/50'}`}
                />
              ))}
            </div>
          )}

          {discountPercentage > 0 && (
            <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full z-20 shadow-sm">
              -{discountPercentage}%
            </div>
          )}
          {badgeText && !discountPercentage && (
            <div className="absolute top-3 left-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full z-20 flex items-center gap-1.5 shadow-md">
              {badgeIcon} {badgeText}
            </div>
          )}

          <button
            className={`absolute top-3 right-3 z-30 p-2 rounded-full shadow-md transition-all duration-300 ${isInWishlist ? 'bg-red-500 text-white' : 'bg-white/80 backdrop-blur-sm text-slate-600 hover:bg-white hover:text-red-500'}`}
            onClick={toggleWishlist}
          >
            <Heart size={18} fill={isInWishlist ? 'white' : 'none'} />
          </button>

          {!product.inStock && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20">
              <span className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                Out of Stock
              </span>
            </div>
          )}

          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm text-xs text-slate-700 px-2.5 py-1 rounded-full z-20 border border-slate-200/50 shadow-sm flex items-center gap-1.5 max-w-[75%]">
            <Tag size={10} className="text-slate-500 flex-shrink-0" />
            <span className="truncate">{categoryDisplay}</span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3.5 sm:p-5 flex-1 flex flex-col">
          <h3 className="font-medium text-sm sm:text-base text-slate-800 line-clamp-2 min-h-[2.5rem] mb-2 leading-snug group-hover:text-green-700 transition-colors">
            {product.name}
          </h3>
          <div className="flex-grow" />

          <div className="flex items-center gap-2 mt-1 mb-2 bg-slate-50 p-2 rounded-md">
            <p className="font-bold text-base sm:text-lg text-slate-900">
              ₹{product.price.toLocaleString('en-IN')}
            </p>
            {product.mrp && product.price < product.mrp && (
              <p className="text-xs text-slate-500 line-through">
                ₹{product.mrp.toLocaleString('en-IN')}
              </p>
            )}
            {discountPercentage > 0 && (
              <p className="text-xs text-white font-medium ml-auto bg-green-500 px-2 py-0.5 rounded">
                SAVE ₹{(product.mrp - product.price).toFixed(0)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex">
              {Array(5)
                .fill('')
                .map((_, index) => (
                  <StarIcon
                    key={index}
                    size={14}
                    fill={rating >= index + 1 ? '#F59E0B' : '#E5E7EB'}
                    strokeWidth={0}
                  />
                ))}
            </div>
            <span className="text-xs text-slate-600 font-medium">
              {rating.toFixed(1)} | {product.rating?.length || 0} Reviews
            </span>
          </div>

          <div className="mb-3">
            {product.inStock ? (
              <span className="text-xs text-green-600 font-medium">
                ✓ In Stock ({product.quantity ?? 'Available'})
              </span>
            ) : (
              <span className="text-xs text-red-500 font-medium">✗ Out of Stock</span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-1 mt-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/product/${product.id}`);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-md transition-all duration-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium border border-slate-200"
            >
              <ExternalLink size={16} />
              View Details
            </button>
            <button
              onClick={handleCartAction}
              disabled={!product.inStock}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-md transition-all duration-200 text-sm font-medium ${
                !product.inStock
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : isInCart
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-sm border border-transparent'
              } ${isActionInProgress ? 'scale-95' : ''}`}
            >
              {!product.inStock ? (
                'Out of Stock'
              ) : isInCart ? (
                <>
                  <CheckCircle size={16} className="text-red-500" />
                  Added to Cart
                </>
              ) : (
                <>
                  <ShoppingCart size={16} />
                  Add to Cart
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;