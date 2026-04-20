// C:\Users\Siddharathan\Desktop\gocart-ecommerce-full-stack\components\ProductDetails.jsx
'use client';
import {
  StarIcon,
  ShieldCheckIcon,
  TruckIcon,
  ShoppingCartIcon,
  ShareIcon,
  CheckIcon,
  Zap,
  RefreshCw,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '@/lib/features/cart/cartSlice';
import toast from 'react-hot-toast';

const ProductDetails = ({ product }) => {
  const productId = product.id;

  const cartItems = useSelector((state) => state.cart.items || []);
  const itemInCart = cartItems.find((item) => item.id === productId);

  const dispatch = useDispatch();
  const router = useRouter();

  const [mainImage, setMainImage] = useState(product.images[0]);
  const [imageLoading, setImageLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef(null);

  const availableStock = product.quantity ?? product.stock ?? 0;

  const averageRating =
    product.rating?.length > 0
      ? product.rating.reduce((sum, r) => sum + r.rating, 0) / product.rating.length
      : 0;

  const discountPercentage =
    product.mrp && product.price < product.mrp
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  const categoryDisplay = Array.isArray(product.category)
    ? product.category.join(' + ')
    : product.category || '';

  useEffect(() => {
    if (itemInCart) setQuantity(itemInCart.quantity);
  }, [itemInCart]);

  const increaseQty = () => {
    if (quantity >= availableStock) {
      toast.error(`Only ${availableStock} item${availableStock !== 1 ? 's' : ''} available`, {
        icon: '⚠️',
        style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });
      return;
    }
    setQuantity((prev) => prev + 1);
  };

  const decreaseQty = () => setQuantity((prev) => Math.max(1, prev - 1));

  const addToCartHandler = () => {
    if (availableStock === 0) {
      toast.error('This product is out of stock');
      return;
    }

    dispatch(
      addToCart({
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || '/placeholder.png',
          quantity,
          category: categoryDisplay,
          stock: availableStock,
          storeId: product.storeId, // ✅ FIX: storeId saved into cart
        },
      })
    );

    toast.success(`${product.name} added to your cart!`, {
      icon: '🛒',
      style: { borderRadius: '10px', background: '#333', color: '#fff' },
    });
  };

  const handleImageMouseMove = (e) => {
    if (!imageContainerRef.current) return;
    const { left, top, width, height } = imageContainerRef.current.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - left) / width) * 100,
      y: ((e.clientY - top) / height) * 100,
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex max-lg:flex-col gap-6 lg:gap-12 p-6 lg:p-8">
        {/* Images */}
        <div className="flex max-sm:flex-col-reverse gap-4 md:gap-6 lg:w-[45%]">
          <div className="flex sm:flex-col gap-3 sm:min-w-24">
            {product.images.map((image, index) => (
              <div
                key={index}
                onClick={() => setMainImage(image)}
                className={`relative bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center size-24 rounded-xl cursor-pointer transition border-2 overflow-hidden
                  ${mainImage === image ? 'border-blue-500 shadow-sm' : 'border-transparent hover:border-slate-300'}`}
              >
                <Image
                  src={image}
                  alt={`${product.name} ${index + 1}`}
                  width={80}
                  height={80}
                  className="object-contain p-2 transition-all duration-300 hover:scale-110"
                />
              </div>
            ))}
          </div>

          <div
            ref={imageContainerRef}
            className="relative flex justify-center items-center h-100 sm:size-113 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl overflow-hidden group"
            onMouseMove={handleImageMouseMove}
            onMouseEnter={() => setIsZoomed(true)}
            onMouseLeave={() => setIsZoomed(false)}
          >
            {imageLoading && (
              <div className="absolute inset-0 bg-gradient-to-r from-slate-100 to-slate-200 animate-pulse" />
            )}
            {isZoomed ? (
              <div className="absolute inset-0 overflow-hidden">
                <Image
                  src={mainImage}
                  alt={product.name}
                  width={1000}
                  height={1000}
                  onLoad={() => setImageLoading(false)}
                  className="object-contain absolute w-[200%] h-[200%]"
                  style={{
                    transformOrigin: 'top left',
                    transform: `translate(-${mousePosition.x}%, -${mousePosition.y}%) scale(2)`,
                  }}
                />
              </div>
            ) : (
              <Image
                src={mainImage}
                alt={product.name}
                width={500}
                height={500}
                onLoad={() => setImageLoading(false)}
                className={`object-contain p-6 transition-transform duration-500 group-hover:scale-110 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
              />
            )}
            <div className="absolute bottom-3 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-slate-600 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full">
                Hover to zoom
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">{product.name}</h1>

          <div className="flex flex-wrap items-center gap-4 mb-5">
            {categoryDisplay && (
              <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-medium">
                {categoryDisplay}
              </span>
            )}
            <div className="flex items-center gap-3">
              <div className="flex">
                {Array(5)
                  .fill('')
                  .map((_, i) => (
                    <StarIcon
                      key={i}
                      size={16}
                      fill={averageRating >= i + 1 ? '#fbbf24' : '#e5e7eb'}
                      strokeWidth={0}
                    />
                  ))}
              </div>
              <span className="text-sm text-slate-600">
                <span className="font-medium">{averageRating.toFixed(1)}</span> (
                {product.rating?.length || 0} reviews)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-5">
            <div className="flex flex-col">
              <p className="text-3xl font-bold text-slate-800">
                ₹{product.price?.toLocaleString('en-IN')}
              </p>
              {product.mrp && product.price < product.mrp && (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-400 line-through">
                    ₹{product.mrp?.toLocaleString('en-IN')}
                  </p>
                  <span className="text-xs text-green-600 font-medium">
                    Save ₹{(product.mrp - product.price).toFixed(2)} ({discountPercentage}% off)
                  </span>
                </div>
              )}
            </div>
            <div
              className={`ml-auto px-3 py-1.5 rounded-full text-sm font-medium ${availableStock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
            >
              {availableStock > 0 ? `In Stock (${availableStock})` : 'Out of Stock'}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-slate-800 mb-2">Description</h3>
            <p className="text-slate-600 leading-relaxed">
              {product.description && product.description.length > 250
                ? `${product.description.substring(0, 250)}...`
                : product.description}
            </p>
          </div>

          {/* Key Features */}
          {Array.isArray(product.keyFeatures) && product.keyFeatures.length > 0 && (
            <div className="mb-6 bg-slate-50 p-4 rounded-xl">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Key Features</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {product.keyFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="bg-green-100 p-1 rounded-full flex-shrink-0">
                      <CheckIcon size={12} className="text-green-600" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-6">
            <p className="text-sm text-slate-700 mb-2 font-medium">
              Quantity
              {availableStock > 0 && (
                <span className="ml-2 text-xs text-slate-400 font-normal">
                  (max {availableStock})
                </span>
              )}
            </p>
            <div className="flex items-center w-36 border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={decreaseQty}
                disabled={availableStock === 0}
                className="w-12 h-12 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                -
              </button>
              <div className="flex-1 h-12 flex items-center justify-center font-medium text-slate-800">
                {quantity}
              </div>
              <button
                onClick={increaseQty}
                disabled={availableStock === 0}
                className="w-12 h-12 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                +
              </button>
            </div>
            {quantity >= availableStock && availableStock > 0 && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                <X size={12} />
                Only {availableStock} item{availableStock !== 1 ? 's' : ''} available
              </p>
            )}
          </div>

          {/* Cart Actions */}
          <div className="flex flex-wrap items-center gap-4 mt-6">
            <button
              onClick={() => (itemInCart ? router.push('/cart') : addToCartHandler())}
              disabled={availableStock === 0}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed
                ${itemInCart ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'}`}
            >
              <ShoppingCartIcon size={18} />
              {availableStock === 0 ? 'Out of Stock' : itemInCart ? 'View Cart' : 'Add to Cart'}
            </button>
            <button className="px-4 py-3.5 rounded-xl font-medium bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all">
              <ShareIcon size={20} />
            </button>
          </div>

          {/* Feature badges */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            {[
              {
                Icon: TruckIcon,
                color: 'text-blue-500',
                bg: 'bg-blue-50',
                label: 'Free Delivery',
                sub: 'Orders above ₹500',
              },
              {
                Icon: RefreshCw,
                color: 'text-green-500',
                bg: 'bg-green-50',
                label: 'Easy Returns',
                sub: '30-day policy',
              },
              {
                Icon: ShieldCheckIcon,
                color: 'text-purple-500',
                bg: 'bg-purple-50',
                label: 'Secure Payment',
                sub: '100% safe checkout',
              },
              {
                Icon: Zap,
                color: 'text-amber-500',
                bg: 'bg-amber-50',
                label: 'Fast Shipping',
                sub: '2-3 business days',
              },
            ].map(({ Icon, color, bg, label, sub }) => (
              <div key={label} className={`flex items-center gap-2 p-3 rounded-lg ${bg}`}>
                <Icon size={16} className={color} />
                <div>
                  <p className="text-xs font-semibold text-slate-700">{label}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;