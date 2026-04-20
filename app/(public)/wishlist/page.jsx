'use client';
import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
    Heart, ShoppingCart, Trash2, ArrowRight, ChevronLeft, 
    AlertTriangle, X, Bookmark, Tag, Eye, PackageCheck,
    ShoppingBag, CheckCircle, Package, Clock
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { removeFromWishlist, clearWishlist } from '@/lib/features/wishlist/wishlistSlice';
import { addToCart } from '@/lib/features/cart/cartSlice';

const WishlistPage = () => {
    const wishlistItems = useSelector(state => state.wishlist.items); 
    const dispatch = useDispatch();
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [productToRemove, setProductToRemove] = useState(null);
    const [isMovingToCart, setIsMovingToCart] = useState(false);
    const [showClearConfirmation, setShowClearConfirmation] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    
    // Initialize selectedItems with all wishlist items
    useEffect(() => {
        setSelectedItems(wishlistItems.map(item => item.id));
    }, [wishlistItems]);
    
    const confirmRemoveFromWishlist = (product) => {
        setProductToRemove(product);
        setShowConfirmation(true);
    };
    
    const removeFromWishlistHandler = (productId) => {
        dispatch(removeFromWishlist(productId));
        
        setShowConfirmation(false);
        setProductToRemove(null);
        
        toast.success('Removed from wishlist', {
            icon: '💔',
            style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
            }
        });
    };

    const handleSelectItem = (productId) => {
        if (selectedItems.includes(productId)) {
            setSelectedItems(selectedItems.filter(id => id !== productId));
        } else {
            setSelectedItems([...selectedItems, productId]);
        }
    };

    const handleSelectAll = () => {
        if (selectedItems.length === wishlistItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(wishlistItems.map(item => item.id));
        }
    };
    
    const addToCartHandler = (product) => {
        setIsMovingToCart(true);
        
        // Create a cart-ready product object
        const cartProduct = {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1,
            category: product.category,
            stock: 10 // All products are in stock
        };
        
        // Add to cart with a small delay to show animation effect
        setTimeout(() => {
            dispatch(addToCart({ product: cartProduct }));
            
            toast.success(`${product.name} added to cart`, {
                icon: '🛒',
                style: {
                    borderRadius: '10px',
                    background: '#333',
                    color: '#fff',
                }
            });
            
            setIsMovingToCart(false);
        }, 300);
    };

    const addSelectedToCart = () => {
        const selectedProducts = wishlistItems.filter(item => selectedItems.includes(item.id));
        
        selectedProducts.forEach(product => {
            addToCartHandler(product);
        });

        toast.success(`${selectedProducts.length} items added to cart`, {
            icon: '🛒',
            style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
            }
        });
    };
    
    if (wishlistItems.length === 0) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-slate-100">
                    <div className="w-24 h-24 mx-auto mb-6 flex items-center justify-center rounded-full bg-red-50/50">
                        <Heart size={40} className="text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-3">Your wishlist is empty</h1>
                    <p className="text-slate-500 mb-8 max-w-md mx-auto">Discover and save items you love to your wishlist for easy access later.</p>
                    <Link 
                        href="/shop" 
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-medium py-3 px-8 rounded-full transition-all shadow-sm hover:shadow"
                    >
                        Discover Products
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Confirmation Dialog for removing individual item */}
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
                                        Are you sure you want to remove <span className="font-medium text-slate-800">{productToRemove.name}</span> from your wishlist?
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
                                            <p className="text-sm text-slate-500">₹{productToRemove.price.toFixed(2)}</p>
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
                                            onClick={() => removeFromWishlistHandler(productToRemove.id)}
                                        >
                                            <Trash2 size={16} />
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Dialog for clearing wishlist */}
            <AnimatePresence>
                {showClearConfirmation && (
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
                                    <h3 className="text-lg font-semibold text-slate-800">Clear Wishlist</h3>
                                </div>
                                <button 
                                    className="text-slate-400 hover:text-slate-600"
                                    onClick={() => setShowClearConfirmation(false)}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-5">
                                <p className="text-slate-600 mb-4">
                                    Are you sure you want to clear all items from your wishlist? This action cannot be undone.
                                </p>
                                
                                <div className="flex gap-3">
                                    <button 
                                        className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                                        onClick={() => setShowClearConfirmation(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center justify-center gap-2"
                                        onClick={() => {
                                            dispatch(clearWishlist());
                                            setShowClearConfirmation(false);
                                            toast.success('Wishlist cleared', {
                                                icon: '🗑️',
                                                style: {
                                                    borderRadius: '10px',
                                                    background: '#333',
                                                    color: '#fff',
                                                }
                                            });
                                        }}
                                    >
                                        <Trash2 size={16} />
                                        Clear All
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 mb-1 flex items-center gap-3">
                            <Heart size={24} className="text-red-500" />
                            My Wishlist
                        </h1>
                        <p className="text-slate-500">{wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved for later</p>
                    </div>
                    <Link 
                        href="/shop" 
                        className="mt-4 md:mt-0 inline-flex items-center gap-2 text-red-600 hover:text-red-700 font-medium group"
                    >
                        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Continue Shopping
                    </Link>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="rounded text-green-600 focus:ring-green-500 h-5 w-5"
                                    checked={selectedItems.length === wishlistItems.length && wishlistItems.length > 0}
                                    onChange={handleSelectAll}
                                />
                                <span className="text-sm font-medium text-slate-700">
                                    {selectedItems.length === wishlistItems.length && wishlistItems.length > 0 
                                        ? "Deselect All" 
                                        : "Select All"}
                                </span>
                            </label>
                            {selectedItems.length > 0 && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                    {selectedItems.length} selected
                                </span>
                            )}
                        </div>
                        {selectedItems.length > 0 && (
                            <button 
                                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center gap-2"
                                onClick={addSelectedToCart}
                            >
                                <ShoppingCart size={16} />
                                Add Selected to Cart
                            </button>
                        )}
                    </div>
                    
                    <div className="hidden md:grid grid-cols-10 gap-4 p-6 border-b border-slate-100 text-sm font-medium text-slate-600 bg-slate-50">
                        <div className="col-span-1"></div>
                        <div className="col-span-6">Product</div>
                        <div className="col-span-2 text-center">Price</div>
                        <div className="col-span-1 text-right">Actions</div>
                    </div>
                    
                    <div className="divide-y divide-slate-100">
                        <AnimatePresence>
                            {wishlistItems.map((item) => (
                                <motion.div 
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                    transition={{ duration: 0.3 }}
                                    className="grid grid-cols-1 md:grid-cols-10 gap-4 p-6 items-center"
                                >
                                    {/* Checkbox for selection */}
                                    <div className="col-span-1 flex justify-start">
                                        <input 
                                            type="checkbox" 
                                            className="rounded text-green-600 focus:ring-green-500 h-5 w-5"
                                            checked={selectedItems.includes(item.id)}
                                            onChange={() => handleSelectItem(item.id)}
                                        />
                                    </div>
                                
                                    {/* Product details */}
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
                                            <h3 className="font-medium text-slate-800 mb-1 hover:text-red-600 transition-colors">
                                                <Link href={`/product/${item.id}`}>
                                                    {item.name}
                                                </Link>
                                            </h3>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                                                    <Tag size={10} />
                                                    {item.category}
                                                </span>
                                                <Link 
                                                    href={`/product/${item.id}`}
                                                    className="text-slate-400 hover:text-blue-500 text-xs flex items-center gap-1 transition-colors"
                                                >
                                                    <Eye size={12} />
                                                    View details
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Price */}
                                    <div className="col-span-2 text-center md:text-center order-1 md:order-none">
                                        <span className="md:hidden text-sm text-slate-500 mr-2">Price: </span>
                                        <span className="font-medium text-slate-800">₹{item.price.toFixed(2)}</span>
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="col-span-1 flex justify-end gap-3 order-3 md:order-none">
                                        <button 
                                            onClick={() => addToCartHandler(item)}
                                            className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2"
                                        >
                                            <ShoppingCart size={16} />
                                        </button>
                                        <button 
                                            onClick={() => confirmRemoveFromWishlist(item)}
                                            className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                            aria-label="Remove from wishlist"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
                
                {/* Buttons for bulk actions */}
                <div className="mt-6 flex justify-between items-center flex-wrap gap-4">
                    <button 
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-6 rounded-lg transition-all shadow-sm hover:shadow"
                        onClick={() => {
                            wishlistItems.forEach(item => addToCartHandler(item));
                            
                            toast.success(`${wishlistItems.length} items added to cart`, {
                                icon: '🛒',
                                style: {
                                    borderRadius: '10px',
                                    background: '#333',
                                    color: '#fff',
                                }
                            });
                        }}
                    >
                        <ShoppingCart size={18} />
                        Add All to Cart
                    </button>
                    
                    <button 
                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-6 rounded-lg transition-colors"
                        onClick={() => setShowClearConfirmation(true)}
                    >
                        <Trash2 size={18} />
                        Clear Wishlist
                    </button>
                </div>
                
                {/* Recently Viewed / Recommendations */}
                <div className="mt-12">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Bookmark size={20} className="text-red-500" />
                        More products you might like
                    </h2>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {/* Placeholder for recommended products - would typically come from an API */}
                        {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <div className="aspect-square bg-slate-100 relative">
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                        <Package size={24} />
                                    </div>
                                </div>
                                <div className="p-3">
                                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-slate-200 rounded w-1/2 mb-3"></div>
                                    <div className="h-6 bg-red-200 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default WishlistPage;
