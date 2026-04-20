// app/store/add-product/page.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingBag,
  Tag,
  IndianRupee,
  Package,
  UploadCloud,
  X,
  PlusCircle,
  Loader2,
  Pencil,
  Zap,
  Plus,
  Trash2,
  Layers,
  Barcode,
  Hash,
} from 'lucide-react';

// ── Empty variant factory ─────────────────────────────────────────
const emptyVariant = (label) => ({ label, barcode: '', price: '', stock: '' });

// ── Add Variant Modal ─────────────────────────────────────────────
function AddVariantModal({ existingLabels, onAdd, onClose }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      toast.error('Variant name cannot be empty');
      return;
    }
    if (trimmed.length > 30) {
      toast.error('Variant name must be 30 characters or less');
      return;
    }
    const isDuplicate = existingLabels.some(
      (l) => l.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }
    onAdd(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 z-10">
        <h3 className="text-base font-semibold text-slate-800 mb-1">Add Size / Variant</h3>
        <p className="text-xs text-slate-400 mb-4">
          e.g. S, M, XL, Regular, Oversize, Slim Fit, 42, Kids…
        </p>
        <input
          ref={inputRef}
          type="text"
          maxLength={30}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Enter variant label"
          className="w-full p-3 px-4 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 text-sm placeholder:text-slate-400 mb-1"
        />
        <p className="text-xs text-slate-400 text-right mb-4">{input.trim().length}/30</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
          >
            <Plus size={14} />
            Add Variant
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function AddProductPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const editId = searchParams.get('id');
  const isEditMode = Boolean(editId);

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEditMode);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [keyFeatures, setKeyFeatures] = useState(['']);

  // ── Variant state ─────────────────────────────────────────────
  // variantList: [{ label, barcode, price, stock, id? }]
  const [variantList, setVariantList] = useState([]);
  const [activeLabel, setActiveLabel] = useState(null); // currently selected chip
  const [showAddModal, setShowAddModal] = useState(false);

  const [productInfo, setProductInfo] = useState({
    name: '',
    description: '',
    mrp: '',
    selectedCategories: [],
  });

  // ── Fetch categories ──────────────────────────────────────────
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
    fetchCategories();
  }, []);

  // ── Fetch product for edit mode ───────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;
    const fetchProduct = async () => {
      try {
        setPageLoading(true);
        const token = await getToken();
        const { data } = await axios.get('/api/store/product', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const product = (data.products || []).find((p) => p.id === editId);
        if (!product) {
          toast.error('Product not found');
          router.replace('/store/manage-product');
          return;
        }
        setProductInfo({
          name: product.name,
          description: product.description,
          mrp: product.mrp,
          selectedCategories: product.category || [],
        });
        setExistingImages(product.images || []);
        setKeyFeatures(
          Array.isArray(product.keyFeatures) && product.keyFeatures.length > 0
            ? product.keyFeatures
            : ['']
        );
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
        }
      } catch {
        toast.error('Failed to load product');
      } finally {
        setPageLoading(false);
      }
    };
    fetchProduct();
  }, [isEditMode, editId, getToken, router]);

  // ── Variant helpers ───────────────────────────────────────────
  const addVariant = (label) => {
    setVariantList((prev) => [...prev, emptyVariant(label)]);
    setActiveLabel(label);
  };

  const removeVariant = (label) => {
    setVariantList((prev) => prev.filter((v) => v.label !== label));
    setActiveLabel((cur) => {
      if (cur !== label) return cur;
      const remaining = variantList.filter((v) => v.label !== label);
      return remaining.length > 0 ? remaining[0].label : null;
    });
  };

  const updateVariantField = (label, field, value) => {
    setVariantList((prev) =>
      prev.map((v) => (v.label === label ? { ...v, [field]: value } : v))
    );
  };

  const activeVariant = variantList.find((v) => v.label === activeLabel) || null;

  // ── Image handlers ────────────────────────────────────────────
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeNewImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingImage = (index) =>
    setExistingImages((prev) => prev.filter((_, i) => i !== index));

  // ── Key Features ─────────────────────────────────────────────
  const addFeatureField = () => setKeyFeatures((prev) => [...prev, '']);
  const updateFeature = (index, value) =>
    setKeyFeatures((prev) => prev.map((f, i) => (i === index ? value : f)));
  const removeFeature = (index) =>
    setKeyFeatures((prev) => prev.filter((_, i) => i !== index));

  const toggleCategory = (categoryName) => {
    setProductInfo((prev) => {
      const already = prev.selectedCategories.includes(categoryName);
      return {
        ...prev,
        selectedCategories: already
          ? prev.selectedCategories.filter((c) => c !== categoryName)
          : [...prev.selectedCategories, categoryName],
      };
    });
  };

  // ── Validation ────────────────────────────────────────────────
  const validateVariants = () => {
    if (variantList.length === 0) {
      toast.error('Please add at least one size / variant');
      return false;
    }
    for (const v of variantList) {
      if (!v.barcode?.trim()) {
        toast.error(`Please enter barcode for variant "${v.label}"`);
        setActiveLabel(v.label);
        return false;
      }
      if (!v.price || Number(v.price) <= 0) {
        toast.error(`Please enter a valid price for variant "${v.label}"`);
        setActiveLabel(v.label);
        return false;
      }
      if (v.stock === '' || v.stock === undefined || Number(v.stock) < 0) {
        toast.error(`Please enter stock for variant "${v.label}"`);
        setActiveLabel(v.label);
        return false;
      }
    }
    return true;
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (productInfo.selectedCategories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }
    if (!validateVariants()) return;

    const cleanedFeatures = keyFeatures.filter((f) => f.trim() !== '');
    // Map label → size for DB compatibility
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

      if (isEditMode) {
        await axios.put(
          `/api/store/product?id=${editId}`,
          {
            name: productInfo.name,
            description: productInfo.description,
            mrp: Number(productInfo.mrp),
            category: productInfo.selectedCategories,
            existingImages,
            keyFeatures: cleanedFeatures,
            variants: variantPayload,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        toast.success('Product updated successfully');
        router.push('/store/manage-product');
      } else {
        const formData = new FormData();
        formData.append('name', productInfo.name);
        formData.append('description', productInfo.description);
        formData.append('mrp', productInfo.mrp);
        formData.append('category', JSON.stringify(productInfo.selectedCategories));
        formData.append('keyFeatures', JSON.stringify(cleanedFeatures));
        formData.append('variants', JSON.stringify(variantPayload));
        imageFiles.forEach((file) => formData.append('images', file));

        const { data } = await axios.post('/api/store/product', formData, {
          headers: { Authorization: `Bearer ${token}` },
        });

        toast.success(data.message || 'Product added successfully');

        setProductInfo({ name: '', description: '', mrp: '', selectedCategories: [] });
        imagePreviews.forEach((url) => URL.revokeObjectURL(url));
        setImageFiles([]);
        setImagePreviews([]);
        setKeyFeatures(['']);
        setVariantList([]);
        setActiveLabel(null);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading product...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil size={24} className="text-indigo-500" />
                Edit Product
              </>
            ) : (
              <>
                <PlusCircle size={24} className="text-indigo-500" />
                Add New Product
              </>
            )}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {isEditMode
              ? 'Update product details and variants'
              : 'Fill in details and add size variants with barcodes'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6"
        >
          {/* ── Images ───────────────────────────────────────── */}
          <div>
            <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
              <UploadCloud size={16} className="text-indigo-500" />
              Product Images
            </p>

            {existingImages.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-2">Current images</p>
                <div className="flex flex-wrap gap-3">
                  {existingImages.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-lg overflow-hidden border border-slate-200"
                    >
                      <Image
                        width={96}
                        height={96}
                        src={src}
                        alt={`Existing ${idx + 1}`}
                        className="h-24 w-24 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {imagePreviews.length > 0 && (
              <div className="mb-4">
                {isEditMode && (
                  <p className="text-xs text-slate-400 mb-2">New images to add</p>
                )}
                <div className="flex flex-wrap gap-3">
                  {imagePreviews.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-lg overflow-hidden border border-slate-200"
                    >
                      <Image
                        width={96}
                        height={96}
                        src={src}
                        alt={`Preview ${idx + 1}`}
                        className="h-24 w-24 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewImage(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-6 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
              <UploadCloud size={28} className="text-slate-400 mb-2" />
              <span className="text-sm text-slate-500">
                {isEditMode ? 'Click to add more images' : 'Click to upload images'}
              </span>
              <span className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP (multiple allowed)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          </div>

          {/* ── Product Name ──────────────────────────────────── */}
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <ShoppingBag size={16} className="text-purple-500" />
              Product Name
            </span>
            <input
              type="text"
              value={productInfo.name}
              onChange={(e) => setProductInfo({ ...productInfo, name: e.target.value })}
              placeholder="Enter product name"
              className="w-full p-3 px-4 outline-none border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-400"
            />
          </label>

          {/* ── Description ───────────────────────────────────── */}
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <Tag size={16} className="text-amber-500" />
              Description
            </span>
            <textarea
              value={productInfo.description}
              onChange={(e) =>
                setProductInfo({ ...productInfo, description: e.target.value })
              }
              placeholder="Describe your product"
              rows={4}
              className="w-full p-3 px-4 outline-none border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-400"
            />
          </label>

          {/* ── MRP ───────────────────────────────────────────── */}
          <label className="flex flex-col gap-2 max-w-xs">
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <IndianRupee size={16} className="text-red-500" />
              MRP (Display Price)
              <span className="text-xs text-slate-400 font-normal">
                (base price shown on product page)
              </span>
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

          {/* ── SIZES & VARIANTS ──────────────────────────────── */}
          <div>
            <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
              <Layers size={16} className="text-indigo-500" />
              Sizes &amp; Variants
              <span className="text-xs text-slate-400 font-normal">
                (add variants, click to fill details)
              </span>
            </p>

            {/* Chip row + Add button */}
            <div className="flex flex-wrap gap-2 mb-4">
              {variantList.map((v) => {
                const isActive = activeLabel === v.label;
                return (
                  <div key={v.label} className="relative group">
                    <button
                      type="button"
                      onClick={() => setActiveLabel(v.label)}
                      className={`pl-4 pr-8 py-2 rounded-full text-sm font-semibold border transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {isActive && <span className="mr-1">✓</span>}
                      {v.label}
                    </button>
                    {/* Delete chip */}
                    <button
                      type="button"
                      onClick={() => removeVariant(v.label)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-colors ${
                        isActive
                          ? 'text-indigo-200 hover:text-white hover:bg-indigo-500'
                          : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                      }`}
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}

              {/* Add variant button */}
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                <Plus size={14} />
                Add Size &amp; Variant
              </button>
            </div>

            {/* Active variant detail fields */}
            {activeVariant ? (
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center px-3 h-8 bg-indigo-600 text-white rounded-lg text-sm font-bold">
                    {activeVariant.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    Fill in details for this variant
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Barcode */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Barcode
                    </label>
                    <div className="relative">
                      <Barcode
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="e.g. 8901234567890"
                        value={activeVariant.barcode}
                        onChange={(e) =>
                          updateVariantField(activeVariant.label, 'barcode', e.target.value)
                        }
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 bg-white placeholder:text-slate-300"
                      />
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Price (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="0.00"
                        min="0"
                        value={activeVariant.price}
                        onChange={(e) =>
                          updateVariantField(activeVariant.label, 'price', e.target.value)
                        }
                        className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 bg-white placeholder:text-slate-300"
                      />
                    </div>
                  </div>

                  {/* Stock */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Stock
                    </label>
                    <div className="relative">
                      <Hash
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        value={activeVariant.stock}
                        onChange={(e) =>
                          updateVariantField(activeVariant.label, 'stock', e.target.value)
                        }
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 bg-white placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary of all variants */}
                {variantList.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-indigo-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
                      All Variants Summary
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {variantList.map((v) => {
                        const filled = v.barcode && v.price && v.stock !== '';
                        return (
                          <div
                            key={v.label}
                            onClick={() => setActiveLabel(v.label)}
                            className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
                              v.label === activeLabel
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                            }`}
                          >
                            <span className="font-semibold">{v.label}</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${filled ? 'bg-green-500' : 'bg-amber-400'}`}
                              title={filled ? 'Complete' : 'Incomplete'}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Green dot = details filled · Click any chip to edit · ✦ Each barcode must be unique.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-700">
                <Layers size={14} className="flex-shrink-0" />
                Click &quot;+ Add Size &amp; Variant&quot; to create your first variant.
              </div>
            )}
          </div>

          {/* ── Key Features ──────────────────────────────────── */}
          <div>
            <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
              <Zap size={16} className="text-yellow-500" />
              Key Features
              <span className="text-xs text-slate-400 font-normal">(optional)</span>
            </p>
            <div className="space-y-2">
              {keyFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-50 text-indigo-500 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => updateFeature(index, e.target.value)}
                    placeholder="e.g. Fast charging, Lightweight design..."
                    className="flex-1 p-2.5 px-4 outline-none border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-400 text-sm"
                  />
                  {keyFeatures.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addFeatureField}
              className="mt-3 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium px-3 py-2 rounded-lg hover:bg-indigo-50 transition-all border border-dashed border-indigo-200"
            >
              <Plus size={15} />
              Add Feature
            </button>
          </div>

          {/* ── Categories ────────────────────────────────────── */}
          <div>
            <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
              <Package size={16} className="text-blue-500" />
              Categories
              {productInfo.selectedCategories.length > 0 && (
                <span className="ml-1 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                  {productInfo.selectedCategories.length} selected
                </span>
              )}
            </p>
            {categoriesLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                <Loader2 size={16} className="animate-spin" />
                Loading categories...
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                No categories found. Ask the admin to create categories first.
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
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {isSelected && <span className="mr-1">✓</span>}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Submit ────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-2">
            {isEditMode && (
              <button
                type="button"
                onClick={() => router.push('/store/manage-product')}
                className="px-6 py-3 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {isEditMode ? 'Saving...' : 'Adding Product...'}
                </>
              ) : isEditMode ? (
                <>
                  <Pencil size={18} />
                  Save Changes
                </>
              ) : (
                <>
                  <PlusCircle size={18} />
                  Add Product
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Add Variant Modal */}
      {showAddModal && (
        <AddVariantModal
          existingLabels={variantList.map((v) => v.label)}
          onAdd={addVariant}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}