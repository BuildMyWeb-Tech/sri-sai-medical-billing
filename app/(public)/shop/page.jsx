// C:\Users\Siddharathan\Desktop\gocart-ecommerce-full-stack\app\(public)\shop\page.jsx
'use client';
import { Suspense, useState, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';
import {
  MoveLeftIcon,
  FilterIcon,
  SlidersHorizontalIcon,
  Search,
  ShoppingBagIcon,
  SortAscIcon,
  CheckCircle2,
  X,
  RefreshCw,
  Zap,
  ChevronRight,
  AlertCircle,
  ArrowUpDown,
  LayoutGrid,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';

function ShopContent() {
  // get query params ?search=abc
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';
  const router = useRouter();

  const products = useSelector((state) => state.product.list);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('featured');

  // Get unique categories from products
  const categories = [
    'All',
    ...new Set(
      products
        .flatMap((p) => (Array.isArray(p.category) ? p.category : [p.category]))
        .filter(Boolean)
    ),
  ];

  // Find min and max product prices
  const minPrice = Math.min(...products.map((p) => p.price), 0);
  const maxPrice = Math.max(...products.map((p) => p.price), 1000);

  useEffect(() => {
    setPriceRange([minPrice, maxPrice]);
  }, [products]);

  // Filter products based on search, category, and price
  const filteredProducts = products.filter((product) => {
    const matchesSearch = search ? product.name.toLowerCase().includes(search.toLowerCase()) : true;

    const matchesCategory = selectedCategory === 'All' ? true :
    Array.isArray(product.category) ? product.category.includes(selectedCategory) : product.category === selectedCategory;
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];

    return matchesSearch && matchesCategory && matchesPrice;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'newest':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      case 'rating':
        const aRating =
          a.rating.reduce((acc, curr) => acc + curr.rating, 0) / (a.rating.length || 1);
        const bRating =
          b.rating.reduce((acc, curr) => acc + curr.rating, 0) / (b.rating.length || 1);
        return bRating - aRating;
      default: // featured or default
        return 0; // keep original order
    }
  });

  // Reset all filters function
  const resetFilters = () => {
    setSelectedCategory('All');
    setPriceRange([minPrice, maxPrice]);
    setSortBy('featured');
    if (search) {
      router.push('/shop');
    }
  };

  return (
    <div className="min-h-[70vh] mx-auto px-4 sm:px-6 max-w-7xl">
      <div className="w-full">
        {/* Header with search results or back button */}
        <div className="flex justify-between items-center my-6">
          <h1
            onClick={() => router.push('/shop')}
            className="text-2xl text-slate-500 flex items-center gap-2 cursor-pointer hover:text-slate-700 transition-colors"
          >
            {search && <MoveLeftIcon size={20} className="animate-pulse" />}
            {search ? (
              <span className="inline-flex items-center">
                Search: "<span className="font-medium text-slate-800">{search}</span>"
              </span>
            ) : (
              <span>
                All{' '}
                <span className="text-slate-700 font-medium bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  Products
                </span>
              </span>
            )}
          </h1>

          {/* Filter & Sort Controls (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-4 pr-10 rounded-lg cursor-pointer text-sm focus:outline-none focus:border-slate-400 shadow-sm hover:border-slate-300 transition-colors"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="newest">Newest First</option>
                <option value="rating">Highest Rated</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-600">
                <ArrowUpDown size={16} />
              </div>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-lg transition-all duration-300 ${
                showFilters
                  ? 'bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-sm hover:shadow'
              }`}
            >
              {showFilters ? (
                <>
                  <PanelLeftClose size={16} />
                  Hide Filters
                </>
              ) : (
                <>
                  <PanelLeft size={16} />
                  Show Filters
                </>
              )}
            </button>
          </div>

          {/* Mobile filter button */}
          <button
            className="md:hidden flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm shadow-sm transition-colors"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FilterIcon size={14} />
            {showFilters ? 'Hide Filters' : 'Filter'}
          </button>
        </div>

        {/* Search bar - for mobile */}
        <div className="md:hidden mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const search = formData.get('search');
              router.push(`/shop?search=${search}`);
            }}
            className="relative"
          >
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search products..."
              className="w-full bg-slate-100 border border-slate-200 py-2.5 pl-10 pr-4 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300 shadow-inner transition-all"
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">
              <Search size={16} />
            </div>
          </form>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Filters sidebar */}
          {showFilters && (
            <div className="w-full md:w-64 bg-white p-5 rounded-xl shadow-md border border-slate-200 h-max animate-in slide-in-from-left-10 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FilterIcon size={16} className="text-emerald-600" />
                  Filters
                </h2>
                <button
                  onClick={resetFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  Reset All
                </button>
              </div>

              <div className="mb-6">
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-gradient-to-b from-emerald-400 to-green-600 rounded-full inline-block"></span>
                  Categories
                </h3>
                <div className="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar pl-2">
                  {categories.map((category) => (
                    <div key={category} className="flex items-center">
                      <input
                        type="radio"
                        id={category}
                        name="category"
                        checked={selectedCategory === category}
                        onChange={() => setSelectedCategory(category)}
                        className="mr-2 accent-emerald-600 w-4 h-4"
                      />
                      <label
                        htmlFor={category}
                        className={`text-sm cursor-pointer transition-colors ${selectedCategory === category ? 'text-emerald-700 font-medium' : 'text-slate-600'}`}
                      >
                        {category}
                      </label>
                      {selectedCategory === category && (
                        <CheckCircle2 size={14} className="ml-1 text-emerald-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full inline-block"></span>
                  Price Range
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={priceRange[0]}
                      onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm shadow-sm focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
                      min={minPrice}
                      max={priceRange[1]}
                    />
                    <span className="absolute left-2.5 top-2.5 text-xs text-slate-500"></span>
                  </div>
                  <span className="text-slate-500">to</span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-sm shadow-sm focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
                      min={priceRange[0]}
                      max={maxPrice}
                    />
                    <span className="absolute left-2.5 top-2.5 text-xs text-slate-500"></span>
                  </div>
                </div>
                <div className="px-1">
                  <input
                    type="range"
                    min={minPrice}
                    max={maxPrice}
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>₹{minPrice}</span>
                    <span>₹{maxPrice}</span>
                  </div>
                </div>
              </div>

              <div className="md:hidden mb-4">
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full inline-block"></span>
                  Sort By
                </h3>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 p-2.5 rounded-lg cursor-pointer text-sm shadow-sm focus:border-slate-300"
                >
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="newest">Newest First</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>

              <div className="flex gap-2 md:hidden">
                <button
                  onClick={() => setShowFilters(false)}
                  className="w-full bg-slate-200 text-slate-700 py-2.5 rounded-lg text-sm transition-colors hover:bg-slate-300 flex items-center justify-center gap-1.5"
                >
                  <X size={14} />
                  Close
                </button>
                <button
                  onClick={resetFilters}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-2.5 rounded-lg text-sm shadow hover:shadow-md transition-all hover:from-emerald-600 hover:to-green-700 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  Reset
                </button>
              </div>

              {/* Active filters summary */}
              {/* {(selectedCategory !== 'All' || priceRange[0] > minPrice || priceRange[1] < maxPrice) && (
                                <div className="mt-6 pt-5 border-t border-slate-100">
                                    <h4 className="text-xs font-medium text-slate-500 mb-2">ACTIVE FILTERS:</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCategory !== 'All' && (
                                            <div className="bg-emerald-50 text-xs text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1.5 border border-emerald-100">
                                                {selectedCategory}
                                                <button 
                                                    onClick={() => setSelectedCategory('All')} 
                                                    className="ml-1 text-emerald-500 hover:text-emerald-700"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )}
                                        {(priceRange[0] > minPrice || priceRange[1] < maxPrice) && (
                                            <div className="bg-amber-50 text-xs text-amber-700 px-2 py-1 rounded-full flex items-center gap-1.5 border border-amber-100">
                                                ₹{priceRange[0]} - ₹{priceRange[1]}
                                                <button 
                                                    onClick={() => setPriceRange([minPrice, maxPrice])} 
                                                    className="ml-1 text-amber-500 hover:text-amber-700"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )} */}
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1">
            {sortedProducts.length > 0 ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    {/* <span className="hidden sm:flex items-center gap-1 bg-white border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded-full shadow-sm">
                                            <LayoutGrid size={14} className="text-emerald-600" />
                                            <span className="hidden sm:inline">View:</span> {showFilters ? '3 columns' : '4 columns'}
                                        </span> */}
                    <span className="bg-white border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded-full shadow-sm">
                      Showing{' '}
                      <span className="font-medium text-emerald-600">{sortedProducts.length}</span>{' '}
                      products
                    </span>
                  </div>

                  {selectedCategory !== 'All' && (
                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs border border-emerald-100">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      {selectedCategory}
                    </span>
                  )}
                </div>

                {/* Dynamic grid that changes columns based on filters visibility */}
                <div
                  className={`grid ${
                    showFilters
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                  } gap-4 md:gap-6 mx-auto mb-32 animate-in fade-in-50 duration-300`}
                >
                  {sortedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                <div className="bg-white p-6 rounded-full mb-6 shadow-md border border-slate-100">
                  <AlertCircle className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-xl font-medium text-slate-800 mb-2">No products found</h3>
                <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                  We couldn't find any products matching your criteria. Try adjusting your filters
                  or search term.
                </p>
                <button
                  onClick={resetFilters}
                  className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-5 py-3 rounded-lg transition-all text-sm font-medium shadow-md hover:shadow-lg flex items-center gap-2 transform hover:-translate-y-0.5"
                >
                  <RefreshCw size={16} />
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Shop() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-10 w-40 bg-slate-200 rounded-full mb-8"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 w-full max-w-7xl px-6">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col space-y-3 bg-white p-4 rounded-xl border border-slate-100"
                >
                  <div className="h-40 sm:h-56 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg"></div>
                  <div className="h-4 bg-slate-200 rounded-full w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded-full w-1/2"></div>
                  <div className="h-9 bg-slate-200 rounded-lg mt-2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <ShopContent />
    </Suspense>
  );
}
