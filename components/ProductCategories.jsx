// components/ProductCategories.jsx
// FIXED: Fetches ALL categories (Admin + Store) for the user page
'use client';
import React, { useState, useEffect, useRef } from 'react';
import Title from './Title';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, ShoppingBag, Loader2 } from 'lucide-react';
import Link from 'next/link';

const ProductCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [windowWidth, setWindowWidth] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [animateOnScroll, setAnimateOnScroll] = useState([]);
  const carouselRef = useRef(null);

  // ── FIX: Use the new /api/categories/all endpoint to get ALL categories ──
  // Admin + Store categories both shown on the user page
  useEffect(() => {
    fetch('/api/categories/all')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  // ── Window resize ───────────────────────────────────────────────
  useEffect(() => {
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Intersection observer for scroll animations ─────────────────
  useEffect(() => {
    if (categories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setAnimateOnScroll((prev) => [...prev, parseInt(entry.target.dataset.index)]);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.category-card').forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [categories]);

  const shouldAutoScroll = () => {
    if (!windowWidth || categories.length <= 3) return false;
    if (windowWidth < 640 && categories.length > 2) return true;
    if (windowWidth >= 640 && windowWidth < 1024 && categories.length > 3) return true;
    if (windowWidth >= 1024 && categories.length > 5) return true;
    return false;
  };

  const autoScroll = shouldAutoScroll();

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeft(carouselRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    carouselRef.current.scrollLeft = scrollLeft - (x - startX) * 2;
  };

  const scroll = (direction) => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-white to-slate-50 overflow-hidden">
      <style jsx>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      <div className="container px-4 sm:px-6 mx-auto max-w-7xl relative">
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-green-100 blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-green-100 blur-3xl translate-x-1/3 translate-y-1/3" />
        </div>

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto relative z-10 mb-5">
          <span className="inline-block px-3 py-1 bg-green-50 text-green-700 text-sm font-semibold rounded-full mb-3 border border-green-100">
            BROWSE CATEGORIES
          </span>
          <Title
            visibleButton={false}
            title="Shop By Category"
            description="Explore our wide range of products organized into intuitive categories for easier shopping."
            className="mb-4"
          />
          <div className="w-20 h-1 bg-gradient-to-r from-green-500 to-green-500 mx-auto mt-5 rounded-full" />
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading categories...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ShoppingBag size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No categories available yet</p>
          </div>
        ) : (
          <div className="relative">
            {autoScroll && (
              <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center border border-slate-200 text-slate-600 hover:text-slate-900 lg:-left-5"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            <div
              ref={carouselRef}
              className={`flex space-x-6 relative z-10 overflow-x-auto scrollbar-none scroll-smooth py-4 ${
                autoScroll ? 'cursor-grab active:cursor-grabbing' : 'justify-center flex-wrap'
              }`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              onMouseDown={autoScroll ? handleMouseDown : null}
              onMouseLeave={autoScroll ? handleMouseLeave : null}
              onMouseUp={autoScroll ? handleMouseUp : null}
              onMouseMove={autoScroll ? handleMouseMove : null}
            >
              {categories.map((category, index) => (
                <motion.div
                  key={category.id}
                  className="category-card flex-shrink-0"
                  data-index={index}
                  initial="hidden"
                  animate={animateOnScroll.includes(index) ? 'visible' : 'hidden'}
                  variants={cardVariants}
                  whileHover={{ scale: 1.03 }}
                  onMouseEnter={() => setActiveCategory(index)}
                  onMouseLeave={() => setActiveCategory(null)}
                >
                  <Link
                    href={`/shop?category=${encodeURIComponent(category.name)}`}
                    className="block"
                  >
                    <div className="flex flex-col items-center group">
                      {/* Circle image */}
                      <div
                        className="relative rounded-full overflow-hidden mb-4 border-4 border-green-100 shadow-md transition-all duration-300 group-hover:shadow-lg group-hover:border-green-300"
                        style={{ width: '180px', height: '180px' }}
                      >
                        <Image
                          src={category.image}
                          alt={category.name}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        {/* Overlay */}
                        <div
                          className={`absolute inset-0 bg-gradient-to-t from-green-700/60 to-transparent transition-opacity duration-300 ${
                            activeCategory === index ? 'opacity-30' : 'opacity-60'
                          }`}
                        />
                      </div>

                      {/* Name */}
                      <h3 className="text-lg font-medium text-slate-800 text-center mb-1 group-hover:text-green-600 transition-colors">
                        {category.name}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-slate-500 text-center max-w-[180px] hidden sm:block line-clamp-2">
                        {category.description}
                      </p>

                      {/* CTA */}
                      <div
                        className={`mt-3 inline-flex items-center justify-center text-xs font-medium rounded-full px-3 py-1 transition-all duration-200 ${
                          activeCategory === index
                            ? 'opacity-100 bg-green-50 text-green-600'
                            : 'opacity-0 bg-transparent text-transparent'
                        }`}
                      >
                        View Products <ChevronRight size={14} className="ml-1" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {autoScroll && (
              <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center border border-slate-200 text-slate-600 hover:text-slate-900 lg:-right-5"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        )}

        <div className="text-center mt-12">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm hover:shadow-md"
          >
            <ShoppingBag size={18} className="mr-2" />
            View All Categories
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ProductCategories;
