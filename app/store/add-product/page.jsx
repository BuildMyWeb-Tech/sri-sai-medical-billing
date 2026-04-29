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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ── FIX #8: Global size list — always visible ─────────────────────
const GLOBAL_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

// ── Empty variant factory ─────────────────────────────────────────
const emptyVariant = (label) => ({ label, barcode: '', price: '', stock: '' });

// ── Add Variant Modal ─────────────────────────────────────────────
function AddVariantModal({ existingLabels, onAdd, onClose }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) { toast.error('Variant name cannot be empty'); return; }
    if (trimmed.length > 30) { toast.error('Variant name must be 30 characters or less'); return; }
    const isDuplicate = existingLabels.some((l) => l.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) { toast.error(`"${trimmed}" already exists`); return; }
    onAdd(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 z-10">
        <h3 className="text-base font-semibold text-slate-800 mb-1">Add Custom Size / Variant</h3>
        <p className="text-xs text-slate-400 mb-4">
          e.g. Regular, Oversize, Slim Fit, 42, Kids…
        </p>
        <input
          ref={inputRef}
          type="text"
          maxLength={30}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
          placeholder="Enter variant label"
          className="w-full p-3 px-4 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 text-sm placeholder:text-slate-400 mb-1"
        />
        <p className="text-xs text-slate-400 text-right mb-4">{input.trim().length}/30</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
            <Plus size={14} /> Add Variant
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Variant detail fields ─────────────────────────────────────────
function VariantFields({ variant, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500 uppercase">Barcode</label>
        <div className="relative">
          <Barcode size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
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

  // ── FIX #8: Global sizes — user selects from GLOBAL_SIZES + custom ──
  // variantList: [{ label, barcode, price, stock, id? }]
  const [variantList, setVariantList] = useState([]);
  const [activeLabel, setActiveLabel] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // ── FIX #7: Optional section toggles ─────────────────────────────
  const [showDescription, setShowDescription] = useState(false);
  const [showMrp, setShowMrp] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [showKeyFeatures, setShowKeyFeatures] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

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
        // Show optional sections that have data
        if (product.description) setShowDescription(true);
        if (product.mrp) setShowMrp(true);
        if (product.images?.length > 0) setShowImages(true);
        if (product.keyFeatures?.length > 0) setShowKeyFeatures(true);
        if (product.category?.length > 0) setShowCategories(true);
      } catch {
        toast.error('Failed to load product');
      } finally {
        setPageLoading(false);
      }
    };
    fetchProduct();
  }, [isEditMode, editId, getToken, router]);

  // ── FIX #8: Toggle global size from GLOBAL_SIZES list ────────
  const toggleGlobalSize = (size) => {
    const exists = variantList.find((v) => v.label === size);
    if (exists) {
      // Remove it
      setVariantList((prev) => prev.filter((v) => v.label !== size));
      setActiveLabel((cur) => {
        if (cur !== size) return cur;
        const remaining = variantList.filter((v) => v.label !== size);
        return remaining.length > 0 ? remaining[0].label : null;
      });
    } else {
      // Add it
      const newVariant = emptyVariant(size);
      setVariantList((prev) => [...prev, newVariant]);
      setActiveLabel(size);
    }
  };

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

  // ── FIX #3: Dynamic validation ────────────────────────────────
  const validateVariants = () => {
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

    // ── FIX #3: Dynamic missing field message ──────────────────
    const missingFields = [];
    if (!productInfo.name?.trim()) missingFields.push('Name');
    if (missingFields.length > 0) {
      toast.error(`Missing fields: ${missingFields.join(', ')}`);
      return;
    }

    // FIX #2: category is now optional — removed the validation
    // FIX #8: variants are required only if any are added (validate them if present)
    if (variantList.length > 0 && !validateVariants()) return;

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
            mrp: Number(productInfo.mrp) || 0,
            // FIX #2: always send category array (may be empty)
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
        formData.append('description', productInfo.description || '');
        formData.append('mrp', productInfo.mrp || 0);
        // FIX #2: always send category (may be empty array)
        formData.append('category', JSON.stringify(productInfo.selectedCategories));
        formData.append('keyFeatures', JSON.stringify(cleanedFeatures));
        formData.append('variants', JSON.stringify(variantPayload));
        // FIX #7: only append images if user selected some
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
        setShowDescription(false);
        setShowMrp(false);
        setShowImages(false);
        setShowKeyFeatures(false);
        setShowCategories(false);
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

  // ── Helper: Section toggle button ─────────────────────────────
  const SectionToggle = ({ show, onToggle, label }) => (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 transition-all border border-dashed border-indigo-200"
    >
      {show ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      {show ? `Hide ${label}` : `+ Add ${label}`}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            {isEditMode ? (
              <><Pencil size={24} className="text-indigo-500" /> Edit Product</>
            ) : (
              <><PlusCircle size={24} className="text-indigo-500" /> Add New Product</>
            )}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {isEditMode
              ? 'Update product details and variants'
              : 'Fill the Below Form To Create a New Product'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6"
        >
          {/* ── Product Name (REQUIRED) ───────────────────────── */}
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <ShoppingBag size={16} className="text-purple-500" />
              Product Name
              <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              value={productInfo.name}
              onChange={(e) => setProductInfo({ ...productInfo, name: e.target.value })}
              placeholder="Enter product name"
              className="w-full p-3 px-4 outline-none border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-400"
            />
          </label>

          {/* ── FIX #7: Optional toggles row ─────────────────── */}
          {/* {!isEditMode && (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-400 font-medium self-center mr-1">Optional:</span>
              <SectionToggle show={showDescription} onToggle={() => setShowDescription((v) => !v)} label="Description" />
              <SectionToggle show={showMrp} onToggle={() => setShowMrp((v) => !v)} label="MRP" />
              <SectionToggle show={showImages} onToggle={() => setShowImages((v) => !v)} label="Images" />
              <SectionToggle show={showKeyFeatures} onToggle={() => setShowKeyFeatures((v) => !v)} label="Key Features" />
              <SectionToggle show={showCategories} onToggle={() => setShowCategories((v) => !v)} label="Categories" />
            </div>
          )} */}

          {/* ── FIX #7: Description (optional, hidden by default) ── */}
          {(showDescription || isEditMode) && (
            <label className="flex flex-col gap-2">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <Tag size={16} className="text-amber-500" />
                Description
                <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </span>
              <textarea
                value={productInfo.description}
                onChange={(e) => setProductInfo({ ...productInfo, description: e.target.value })}
                placeholder="Describe your product"
                rows={4}
                className="w-full p-3 px-4 outline-none border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-400"
              />
            </label>
          )}

          {/* ── FIX #7: MRP (optional, hidden by default) ─────── */}
          {(showMrp || isEditMode) && (
            <label className="flex flex-col gap-2 max-w-xs">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <IndianRupee size={16} className="text-red-500" />
                MRP (Display Price)
                <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
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
          )}

          {/* ── FIX #7: Images (optional, hidden by default) ──── */}
          {(showImages || isEditMode) && (
            <div>
              <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
                <UploadCloud size={16} className="text-indigo-500" />
                Product Images
                <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </p>

              {existingImages.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-2">Current images</p>
                  <div className="flex flex-wrap gap-3">
                    {existingImages.map((src, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200">
                        <Image width={96} height={96} src={src} alt={`Existing ${idx + 1}`} className="h-24 w-24 object-cover" />
                        <button type="button" onClick={() => removeExistingImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {imagePreviews.length > 0 && (
                <div className="mb-4">
                  {isEditMode && <p className="text-xs text-slate-400 mb-2">New images to add</p>}
                  <div className="flex flex-wrap gap-3">
                    {imagePreviews.map((src, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200">
                        <Image width={96} height={96} src={src} alt={`Preview ${idx + 1}`} className="h-24 w-24 object-cover" />
                        <button type="button" onClick={() => removeNewImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-6 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                <UploadCloud size={28} className="text-slate-400 mb-2" />
                <span className="text-sm text-slate-500">{isEditMode ? 'Click to add more images' : 'Click to upload images'}</span>
                <span className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP (multiple allowed)</span>
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
              </label>
            </div>
          )}

          {/* ── FIX #8: SIZES & VARIANTS ──────────────────────── */}
          <div>
            <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
              <Layers size={16} className="text-indigo-500" />
              Sizes &amp; Variants
              <span className="text-xs text-slate-400 font-normal">(select sizes, fill in details)</span>
            </p>

            {/* FIX #8: Global size checkboxes — always visible ── */}
            <div className="mb-4">
              <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">Standard Sizes</p>
              <div className="flex flex-wrap gap-2">
                {GLOBAL_SIZES.map((size) => {
                  const isSelected = variantList.some((v) => v.label === size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggleGlobalSize(size)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {isSelected && <span className="mr-1">✓</span>}
                      {size}
                    </button>
                  );
                })}
                {/* Add custom variant button */}
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-all"
                >
                  <Plus size={14} /> Custom
                </button>
              </div>
            </div>

            {/* Show selected variants as chips */}
            {variantList.length > 0 && (
              <div className="mb-4">
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
                          className={`pl-4 pr-8 py-2 rounded-full text-sm font-semibold border transition-all ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                          }`}
                        >
                          {isActive && <span className="mr-1">✓</span>}
                          {v.label}
                          <span className={`ml-1.5 w-1.5 h-1.5 rounded-full inline-block ${filled ? 'bg-green-400' : 'bg-amber-400'}`} />
                        </button>
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
                </div>
              </div>
            )}

            {/* Active variant detail fields */}
            {activeVariant ? (
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center px-3 h-8 bg-indigo-600 text-white rounded-lg text-sm font-bold">
                    {activeVariant.label}
                  </span>
                  <span className="text-xs text-slate-500">Fill in details for this size</span>
                </div>
                <VariantFields
                  variant={activeVariant}
                  onChange={(field, value) => updateVariantField(activeVariant.label, field, value)}
                />

               
              </div>
            ) : variantList.length === 0 ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-500">
                <Layers size={14} className="flex-shrink-0" />
                Select sizes above or click &quot;Custom&quot; to add a custom variant.
              </div>
            ) : null}
          </div>

          {/* ── FIX #7: Key Features (optional, hidden by default) ── */}
          {(showKeyFeatures || isEditMode) && (
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
                      <button type="button" onClick={() => removeFeature(index)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addFeatureField} className="mt-3 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium px-3 py-2 rounded-lg hover:bg-indigo-50 transition-all border border-dashed border-indigo-200">
                <Plus size={15} /> Add Feature
              </button>
            </div>
          )}

          {/* ── FIX #2: Categories (optional, hidden by default) ── */}
          {(showCategories || isEditMode) && (
            <div>
              <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
                <Package size={16} className="text-blue-500" />
                Categories
                <span className="text-xs text-slate-400 font-normal">(optional)</span>
                {productInfo.selectedCategories.length > 0 && (
                  <span className="ml-1 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                    {productInfo.selectedCategories.length} selected
                  </span>
                )}
              </p>
              {categoriesLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                  <Loader2 size={16} className="animate-spin" /> Loading categories...
                </div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                  No categories found. You can still save the product without one.
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
          )}

          {/* ── Submit ────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-2">
            {isEditMode && (
              <button type="button" onClick={() => router.push('/store/manage-product')} className="px-6 py-3 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all">
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> {isEditMode ? 'Saving...' : 'Adding Product...'}</>
              ) : isEditMode ? (
                <><Pencil size={18} /> Save Changes</>
              ) : (
                <><PlusCircle size={18} /> Add Product</>
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