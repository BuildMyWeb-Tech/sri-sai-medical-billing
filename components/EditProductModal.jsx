// components/EditProductModal.jsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import {
  X,
  ShoppingBag,
  Tag,
  IndianRupee,
  Package,
  Save,
  Camera,
  Loader2,
  Layers,
  Plus,
  Barcode,
  Hash,
  Check,
  AlertCircle,
} from 'lucide-react';

const GLOBAL_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

function VariantFields({ variant, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500 uppercase">Barcode</label>
        <div className="relative">
          <Barcode
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="e.g. 8901234567890"
            value={variant.barcode}
            onChange={(e) => onChange('barcode', e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 bg-white placeholder:text-slate-300"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500 uppercase">Price (₹)</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            ₹
          </span>
          <input
            type="number"
            placeholder="0.00"
            min="0"
            value={variant.price}
            onChange={(e) => onChange('price', e.target.value)}
            className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 bg-white placeholder:text-slate-300"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500 uppercase">Stock</label>
        <div className="relative">
          <Hash size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="number"
            placeholder="0"
            min="0"
            value={variant.stock}
            onChange={(e) => onChange('stock', e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 bg-white placeholder:text-slate-300"
          />
        </div>
      </div>
    </div>
  );
}

export default function EditProductModal({ isOpen, onClose, product, onProductUpdated }) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [variantList, setVariantList] = useState([]);
  const [activeLabel, setActiveLabel] = useState(null);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [storeGlobalSizes, setStoreGlobalSizes] = useState([]);

  const [productInfo, setProductInfo] = useState({
    name: '',
    description: '',
    mrp: '',
    selectedCategories: [],
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = await getToken();
        const { data } = await axios.get('/api/categories', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(data.categories || []);
      } catch {
        toast.error('Failed to load categories');
      } finally {
        setCategoriesLoading(false);
      }
    };
    if (isOpen) fetchCategories();
  }, [isOpen]);

  useEffect(() => {
  const fetchGlobalSizes = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/store/sizes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStoreGlobalSizes(data.sizes || []);
    } catch { /* non-critical */ }
  };
  fetchGlobalSizes();
}, []);

  useEffect(() => {
    if (product) {
      setProductInfo({
        name: product.name || '',
        description: product.description || '',
        mrp: product.mrp || '',
        selectedCategories: Array.isArray(product.category)
          ? product.category
          : product.category
            ? [product.category]
            : [],
      });
      if (product.variants && product.variants.length > 0) {
        const loaded = product.variants.map((v) => ({
          id: v.id,
          label: v.size,
          barcode: v.barcode,
          price: v.price,
          stock: v.stock,
        }));
        setVariantList(loaded);
        setActiveLabel(loaded[0]?.label || null);
      } else {
        setVariantList([]);
        setActiveLabel(null);
      }
    }
  }, [product]);

  const toggleGlobalSize = (size) => {
    const exists = variantList.find((v) => v.label === size);
    if (exists) {
      setVariantList((prev) => prev.filter((v) => v.label !== size));
      setActiveLabel((cur) => {
        if (cur !== size) return cur;
        const remaining = variantList.filter((v) => v.label !== size);
        return remaining.length > 0 ? remaining[0].label : null;
      });
    } else {
      setVariantList((prev) => [...prev, { label: size, barcode: '', price: '', stock: '' }]);
      setActiveLabel(size);
    }
  };

  const addCustomVariant = () => {
    const trimmed = customInput.trim();
    if (!trimmed) {
      toast.error('Enter a variant label');
      return;
    }
    if (variantList.some((v) => v.label.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }
    setVariantList((prev) => [...prev, { label: trimmed, barcode: '', price: '', stock: '' }]);
    setActiveLabel(trimmed);
    setCustomInput('');
    setShowCustomInput(false);
  };

  const removeVariant = (label) => {
    setVariantList((prev) => prev.filter((v) => v.label !== label));
    setActiveLabel((cur) => {
      if (cur !== label) return cur;
      const remaining = variantList.filter((v) => v.label !== label);
      return remaining.length > 0 ? remaining[0].label : null;
    });
  };

  const updateVariantField = (label, field, value) =>
    setVariantList((prev) => prev.map((v) => (v.label === label ? { ...v, [field]: value } : v)));

  const toggleCategory = (name) => {
    setProductInfo((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(name)
        ? prev.selectedCategories.filter((c) => c !== name)
        : [...prev.selectedCategories, name],
    }));
  };

  const validateVariants = () => {
    if (variantList.length === 0) {
      toast.error('Add at least one variant');
      return false;
    }
    for (const v of variantList) {
      if (!v.barcode?.trim()) {
        toast.error(`Enter barcode for "${v.label}"`);
        setActiveLabel(v.label);
        return false;
      }
      if (!v.price || Number(v.price) <= 0) {
        toast.error(`Enter valid price for "${v.label}"`);
        setActiveLabel(v.label);
        return false;
      }
      if (v.stock === '' || Number(v.stock) < 0) {
        toast.error(`Enter stock for "${v.label}"`);
        setActiveLabel(v.label);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!product) return;
    if (!productInfo.name?.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!validateVariants()) return;

    const variantPayload = variantList.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      size: v.label,
      barcode: v.barcode,
      price: Number(v.price),
      stock: Number(v.stock),
    }));

    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await axios.put(
        `/api/store/product?id=${product.id}`,
        {
          name: productInfo.name,
          description: productInfo.description,
          mrp: Number(productInfo.mrp) || 0,
          category: productInfo.selectedCategories,
          existingImages: product.images,
          keyFeatures: product.keyFeatures || [],
          variants: variantPayload,
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      toast.success(data.message || 'Product updated');
      const totalStock = variantList.reduce((s, v) => s + (Number(v.stock) || 0), 0);
      onProductUpdated({
        ...product,
        name: productInfo.name,
        description: productInfo.description,
        mrp: Number(productInfo.mrp),
        category: productInfo.selectedCategories,
        inStock: totalStock > 0,
        variants: variantList.map((v) => ({ ...v, size: v.label })),
      });
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const activeVariant = variantList.find((v) => v.label === activeLabel) || null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <motion.div
          className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="relative w-full max-w-3xl bg-white rounded-xl shadow-xl overflow-hidden z-10"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
        >
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-800">Edit Product</h3>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Current Images (read-only) */}
            {product?.images?.length > 0 && (
              <div>
                <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
                  <Camera size={16} className="text-blue-500" /> Current Images
                </p>
                <div className="flex flex-wrap gap-3">
                  {product.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-lg overflow-hidden border border-slate-200"
                    >
                      <Image
                        width={96}
                        height={96}
                        src={img}
                        alt={`Image ${idx + 1}`}
                        className="h-24 w-24 object-cover"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2 italic">
                  To change images, use the full edit page.
                </p>
              </div>
            )}

            {/* Name */}
            <label className="flex flex-col gap-2">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <ShoppingBag size={16} className="text-purple-500" />
                Product Name
                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-normal">
                  Required
                </span>
              </span>
              <input
                type="text"
                value={productInfo.name}
                onChange={(e) => setProductInfo({ ...productInfo, name: e.target.value })}
                placeholder="Enter product name"
                className="w-full p-3 px-4 outline-none border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-400"
              />
            </label>

            {/* Description */}
             {/* <label className="flex flex-col gap-2">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <Tag size={16} className="text-amber-500" /> Description
                <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </span>
              <textarea
                value={productInfo.description}
                onChange={(e) => setProductInfo({ ...productInfo, description: e.target.value })}
                placeholder="Enter product description"
                rows={3}
                className="w-full p-3 px-4 outline-none border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-400"
              />
            </label> */}

            {/* MRP */}
            <label className="flex flex-col gap-2 max-w-xs">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <IndianRupee size={16} className="text-red-500" /> MRP
                <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  value={productInfo.mrp}
                  onChange={(e) => setProductInfo({ ...productInfo, mrp: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  className="w-full p-3 pl-8 outline-none border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 bg-slate-50"
                />
              </div>
            </label>

            {/* Variants */}
            <div>
              <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
                <Layers size={16} className="text-indigo-500" />
                Sizes &amp; Variants
                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-normal">
                  Min 1 required
                </span>
              </p>

              {/* Standard sizes */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">
                  Standard Sizes
                </p>
                <div className="flex flex-wrap gap-2">
{[...GLOBAL_SIZES, ...storeGlobalSizes.filter((s) => !GLOBAL_SIZES.includes(s))].map((size) => {
                      const isSelected = variantList.some((v) => v.label === size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleGlobalSize(size)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                      >
                        {isSelected && <span className="mr-1">✓</span>}
                        {size}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setShowCustomInput((v) => !v)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    <Plus size={14} /> Custom
                  </button>
                </div>
                {showCustomInput && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomVariant();
                        }
                      }}
                      placeholder="e.g. 42, Kids, Oversize..."
                      className="flex-1 p-2 px-3 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={addCustomVariant}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                    >
                      <Check size={14} /> Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomInput('');
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Selected chips */}
              {variantList.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">
                    Selected ({variantList.length}) — click to edit
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {variantList.map((v) => {
                      const isActive = activeLabel === v.label;
                      const filled = v.barcode && v.price && v.stock !== '';
                      return (
                        <div key={v.label} className="relative group">
                          <button
                            type="button"
                            onClick={() => setActiveLabel(isActive ? null : v.label)}
                            className={`pl-4 pr-8 py-2 rounded-full text-sm font-semibold border transition-all ${isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                          >
                            {isActive && <span className="mr-1">✓</span>}
                            {v.label}
                            <span
                              className={`ml-1.5 w-1.5 h-1.5 rounded-full inline-block ${filled ? 'bg-green-400' : 'bg-amber-400'}`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeVariant(v.label)}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-colors ${isActive ? 'text-indigo-200 hover:text-white hover:bg-indigo-500' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active variant fields */}
              {activeVariant ? (
                <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center px-3 h-8 bg-indigo-600 text-white rounded-lg text-sm font-bold">
                      {activeVariant.label}
                    </span>
                    <span className="text-xs text-slate-500">Fill in details for this size</span>
                  </div>
                  <VariantFields
                    variant={activeVariant}
                    onChange={(field, value) =>
                      updateVariantField(activeVariant.label, field, value)
                    }
                  />
                </div>
              ) : variantList.length === 0 ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-700">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  Select a size or add a custom variant. At least one is required.
                </div>
              ) : null}
            </div>

            {/* Categories */}
            <div>
              <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
                <Package size={16} className="text-blue-500" /> Categories
                <span className="text-xs text-slate-400 font-normal">(optional)</span>
                {productInfo.selectedCategories.length > 0 && (
                  <span className="ml-1 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                    {productInfo.selectedCategories.length} selected
                  </span>
                )}
              </p>
              {categoriesLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
                  <Loader2 size={14} className="animate-spin" /> Loading...
                </div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                  No categories found.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isSelected = productInfo.selectedCategories.includes(cat.name);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.name)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                      >
                        {isSelected && <span className="mr-1">✓</span>}
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
