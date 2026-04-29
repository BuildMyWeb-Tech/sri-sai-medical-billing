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
  AlertCircle,
} from 'lucide-react';

const GLOBAL_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const emptyVariant = (label) => ({ label, barcode: '', price: '', stock: '' });

// ── Add Variant Modal ─────────────────────────────────────────────
function AddVariantModal({ existingLabels, globalSizes = [], onAdd, onClose }) {
  const [input, setInput] = useState('');
  const [saveGlobally, setSaveGlobally] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) { toast.error('Variant name cannot be empty'); return; }
    if (trimmed.length > 30) { toast.error('Variant name must be 30 characters or less'); return; }
    if (existingLabels.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`"${trimmed}" already exists`); return;
    }
    onAdd(trimmed, saveGlobally);
    onClose();
  };

  const unusedGlobalSizes = globalSizes.filter(
    (s) => !existingLabels.includes(s) && !GLOBAL_SIZES.includes(s)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 z-10">
        <h3 className="text-base font-semibold text-slate-800 mb-1">Add Custom Size / Variant</h3>
        <p className="text-xs text-slate-400 mb-4">e.g. Regular, Oversize, Slim Fit, 42, Kids…</p>

        {/* Saved global sizes quick-pick */}
        {/* {unusedGlobalSizes.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Your Saved Sizes</p>
            <div className="flex flex-wrap gap-2">
              {unusedGlobalSizes.map((s) => (
                <button
                  key={s} type="button"
                  onClick={() => { onAdd(s, false); onClose(); }}
                  className="px-3 py-1.5 text-xs font-semibold border border-indigo-200 text-indigo-600 rounded-full hover:bg-indigo-50 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 my-4" />
          </div>
        )} */}

        <input
          ref={inputRef} type="text" maxLength={30} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
          placeholder="Enter variant label"
          className="w-full p-3 px-4 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 text-sm placeholder:text-slate-400 mb-1"
        />
        <p className="text-xs text-slate-400 text-right mb-3">{input.trim().length}/30</p>

        {/* Save globally checkbox */}
        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none group">
          <input
            type="checkbox" checked={saveGlobally}
            onChange={(e) => setSaveGlobally(e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-600"
          />
          <span className="text-sm text-slate-600 group-hover:text-indigo-600 transition-colors">
            Save Size 
             {/* <span className="text-slate-400 text-xs">(reuse in future products)</span> */}
          </span>
        </label>

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
            type="text" placeholder="e.g. 8901234567890" value={variant.barcode}
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
            type="number" placeholder="0.00" min="0" value={variant.price}
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
            type="number" placeholder="0" min="0" value={variant.stock}
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
  const router       = useRouter();
  const searchParams = useSearchParams();

  const editId     = searchParams.get('id');
  const isEditMode = Boolean(editId);

  const [loading, setLoading]               = useState(false);
  const [pageLoading, setPageLoading]       = useState(isEditMode);
  const [categories, setCategories]         = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [imagePreviews, setImagePreviews]   = useState([]);
  const [imageFiles, setImageFiles]         = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [keyFeatures, setKeyFeatures]       = useState(['']);

const [variantList, setVariantList]   = useState([]);
const [activeLabel, setActiveLabel]   = useState(null);
const [showAddModal, setShowAddModal] = useState(false);
const [variantError, setVariantError] = useState(false);
const [storeGlobalSizes, setStoreGlobalSizes] = useState([]);

  const [showDescription,  setShowDescription]  = useState(false);
  const [showMrp,          setShowMrp]          = useState(false);
  const [showImages,       setShowImages]       = useState(false);
  const [showKeyFeatures,  setShowKeyFeatures]  = useState(false);
  const [showCategories,   setShowCategories]   = useState(false);

  const [productInfo, setProductInfo] = useState({
    name: '',
    description: '',
    mrp: '',
    selectedCategories: [],
  });

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = await getToken();
        const { data } = await axios.get('/api/categories', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(data.categories || []);
      } catch { toast.error('Failed to load categories'); }
      finally { setCategoriesLoading(false); }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
  const fetchGlobalSizes = async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/store/sizes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStoreGlobalSizes(data.sizes || []);
    } catch { /* non-critical, silently ignore */ }
  };
  fetchGlobalSizes();
}, []);

  // Fetch product for edit mode
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
            ? product.keyFeatures : ['']
        );
        if (product.variants?.length > 0) {
          const loaded = product.variants.map((v) => ({
            id: v.id, label: v.size, barcode: v.barcode, price: v.price, stock: v.stock,
          }));
          setVariantList(loaded);
          setActiveLabel(loaded[0]?.label || null);
        }
        if (product.description)       setShowDescription(true);
        if (product.mrp)               setShowMrp(true);
        if (product.images?.length)    setShowImages(true);
        if (product.keyFeatures?.length) setShowKeyFeatures(true);
        if (product.category?.length)  setShowCategories(true);
      } catch { toast.error('Failed to load product'); }
      finally { setPageLoading(false); }
    };
    fetchProduct();
  }, [isEditMode, editId, getToken, router]);

  // Clear variant error as soon as user adds a variant
  useEffect(() => {
    if (variantList.length > 0) setVariantError(false);
  }, [variantList.length]);

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
      setVariantList((prev) => [...prev, emptyVariant(size)]);
      setActiveLabel(size);
    }
  };

  const addVariant = async (label, saveGlobally = false) => {
  setVariantList((prev) => [...prev, emptyVariant(label)]);
  setActiveLabel(label);
  if (saveGlobally) {
    try {
      const token = await getToken();
      await axios.post('/api/store/sizes', { label }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStoreGlobalSizes((prev) =>
        prev.includes(label) ? prev : [...prev, label]
      );
      toast.success(`"${label}" saved to your global sizes`);
    } catch { toast.error('Failed to save size globally'); }
  }
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

  // Image handlers
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeNewImage      = (idx) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx); });
  };
  const removeExistingImage = (idx) => setExistingImages((prev) => prev.filter((_, i) => i !== idx));

  // Key features
  const addFeatureField  = () => setKeyFeatures((prev) => [...prev, '']);
  const updateFeature    = (idx, val) => setKeyFeatures((prev) => prev.map((f, i) => (i === idx ? val : f)));
  const removeFeature    = (idx) => setKeyFeatures((prev) => prev.filter((_, i) => i !== idx));

  const toggleCategory = (name) => {
    setProductInfo((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(name)
        ? prev.selectedCategories.filter((c) => c !== name)
        : [...prev.selectedCategories, name],
    }));
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ── FIX: variants required — check BEFORE API call ────────
    if (variantList.length === 0) {
      setVariantError(true);
      toast.error('Please add at least one size / variant');
      return; // Stop here — no API call made
    }

    if (!productInfo.name?.trim()) {
      toast.error('Product name is required');
      return;
    }

    if (!validateVariants()) return;

    const cleanedFeatures  = keyFeatures.filter((f) => f.trim());
    const variantPayload   = variantList.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      size:    v.label,
      barcode: v.barcode,
      price:   Number(v.price),
      stock:   Number(v.stock),
    }));

    try {
      setLoading(true);
      const token = await getToken();

      if (isEditMode) {
        await axios.put(
          `/api/store/product?id=${editId}`,
          {
            name:           productInfo.name,
            description:    productInfo.description,
            mrp:            Number(productInfo.mrp) || 0,
            category:       productInfo.selectedCategories,
            existingImages,
            keyFeatures:    cleanedFeatures,
            variants:       variantPayload,
          },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        toast.success('Product updated successfully');
        router.push('/store/manage-product');
      } else {
        const formData = new FormData();
        formData.append('name',        productInfo.name);
        formData.append('description', productInfo.description || '');
        formData.append('mrp',         productInfo.mrp || 0);
        formData.append('category',    JSON.stringify(productInfo.selectedCategories));
        formData.append('keyFeatures', JSON.stringify(cleanedFeatures));
        formData.append('variants',    JSON.stringify(variantPayload));
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
        setVariantError(false);
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

  const SectionToggle = ({ show, onToggle, label }) => (
    <button type="button" onClick={onToggle}
      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 transition-all border border-dashed border-indigo-200"
    >
      {show ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      {show ? `Hide ${label}` : `+ Add ${label}`}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            {isEditMode
              ? <><Pencil size={24} className="text-indigo-500" /> Edit Product</>
              : <><PlusCircle size={24} className="text-indigo-500" /> Add New Product</>}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {isEditMode ? 'Update product details and variants' : 'Fill the form below to create a new product'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
          {/* Product Name */}
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-700 flex items-center gap-2">
              <ShoppingBag size={16} className="text-purple-500" />
              Product Name <span className="text-red-500">*</span>
            </span>
            <input
              type="text" value={productInfo.name}
              onChange={(e) => setProductInfo({ ...productInfo, name: e.target.value })}
              placeholder="Enter product name"
              className="w-full p-3 px-4 outline-none border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-400"
            />
          </label>

          {/* Description (optional) */}
          {(showDescription || isEditMode) && (
            <label className="flex flex-col gap-2">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <Tag size={16} className="text-amber-500" />
                Description <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </span>
              <textarea
                value={productInfo.description}
                onChange={(e) => setProductInfo({ ...productInfo, description: e.target.value })}
                placeholder="Describe your product" rows={4}
                className="w-full p-3 px-4 outline-none border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-400"
              />
            </label>
          )}

          {/* MRP (optional) */}
          {(showMrp || isEditMode) && (
            <label className="flex flex-col gap-2 max-w-xs">
              <span className="font-medium text-slate-700 flex items-center gap-2">
                <IndianRupee size={16} className="text-red-500" />
                MRP (Display Price) <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                <input
                  type="number" value={productInfo.mrp} min="0" placeholder="0.00"
                  onChange={(e) => setProductInfo({ ...productInfo, mrp: e.target.value })}
                  className="w-full p-3 pl-8 outline-none border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 bg-slate-50"
                />
              </div>
            </label>
          )}

          {/* Images (optional) */}
          {(showImages || isEditMode) && (
            <div>
              <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
                <UploadCloud size={16} className="text-indigo-500" />
                Product Images <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </p>
              {existingImages.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-2">Current images</p>
                  <div className="flex flex-wrap gap-3">
                    {existingImages.map((src, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200">
                        <Image width={96} height={96} src={src} alt="" className="h-24 w-24 object-cover" />
                        <button type="button" onClick={() => removeExistingImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {imagePreviews.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-3">
                  {imagePreviews.map((src, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200">
                      <Image width={96} height={96} src={src} alt="" className="h-24 w-24 object-cover" />
                      <button type="button" onClick={() => removeNewImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-6 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                <UploadCloud size={28} className="text-slate-400 mb-2" />
                <span className="text-sm text-slate-500">Click to upload images</span>
                <span className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP (multiple allowed)</span>
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
              </label>
            </div>
          )}

          {/* ── SIZES & VARIANTS ──────────────────────────────── */}
          <div>
            <p className="font-medium text-slate-700 flex items-center gap-2 mb-1">
              <Layers size={16} className="text-indigo-500" />
              Sizes &amp; Variants
              <span className="text-red-500">*</span>
              <span className="text-xs text-slate-400 font-normal">(at least one required)</span>
            </p>

            {/* ── FIX: show inline error banner when submitted without variants ── */}
            {variantError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-3">
                <AlertCircle size={15} className="flex-shrink-0" />
                Please add at least one size before saving.
              </div>
            )}

            {/* Standard sizes */}
            <div className="mb-4">
             <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">Standard Sizes</p>
<div className="flex flex-wrap gap-2">
  {[...GLOBAL_SIZES, ...storeGlobalSizes.filter((s) => !GLOBAL_SIZES.includes(s))].map((size) => {
                  const isSelected = variantList.some((v) => v.label === size);
                  return (
                    <button key={size} type="button" onClick={() => toggleGlobalSize(size)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                    >
                      {isSelected && <span className="mr-1">✓</span>}{size}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-all"
                >
                  <Plus size={14} /> Custom
                </button>
              </div>
            </div>

            {/* Selected variants */}
            {variantList.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">
                  Selected ({variantList.length}) — click to edit
                </p>
                <div className="flex flex-wrap gap-2">
                  {variantList.map((v) => {
                    const isActive = activeLabel === v.label;
                    const filled   = v.barcode && v.price && v.stock !== '';
                    return (
                      <div key={v.label} className="relative group">
                        <button type="button" onClick={() => setActiveLabel(isActive ? null : v.label)}
                          className={`pl-4 pr-8 py-2 rounded-full text-sm font-semibold border transition-all ${isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                        >
                          {isActive && <span className="mr-1">✓</span>}
                          {v.label}
                          <span className={`ml-1.5 w-1.5 h-1.5 rounded-full inline-block ${filled ? 'bg-green-400' : 'bg-amber-400'}`} />
                        </button>
                        <button type="button" onClick={() => removeVariant(v.label)}
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
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center px-3 h-8 bg-indigo-600 text-white rounded-lg text-sm font-bold">{activeVariant.label}</span>
                  <span className="text-xs text-slate-500">Fill in details for this size</span>
                </div>
                <VariantFields
                  variant={activeVariant}
                  onChange={(field, value) => updateVariantField(activeVariant.label, field, value)}
                />
              </div>
            ) : variantList.length === 0 ? (
              <div className={`flex items-center gap-2 border rounded-lg p-3 text-sm ${variantError ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                <Layers size={14} className="flex-shrink-0" />
                Select sizes above or click &quot;Custom&quot; to add a custom variant.
              </div>
            ) : null}
          </div>

          {/* Key Features (optional) */}
          {(showKeyFeatures || isEditMode) && (
            <div>
              <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
                <Zap size={16} className="text-yellow-500" />
                Key Features <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </p>
              <div className="space-y-2">
                {keyFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-50 text-indigo-500 text-xs font-bold flex items-center justify-center">{idx + 1}</div>
                    <input
                      type="text" value={feature} onChange={(e) => updateFeature(idx, e.target.value)}
                      placeholder="e.g. Fast charging, Lightweight design..."
                      className="flex-1 p-2.5 px-4 outline-none border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 bg-slate-50 placeholder:text-slate-400 text-sm"
                    />
                    {keyFeatures.length > 1 && (
                      <button type="button" onClick={() => removeFeature(idx)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
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

          {/* Categories (optional) */}
          {(showCategories || isEditMode) && (
            <div>
              <p className="font-medium text-slate-700 flex items-center gap-2 mb-3">
                <Package size={16} className="text-blue-500" />
                Categories <span className="text-xs text-slate-400 font-normal">(optional)</span>
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
                <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">No categories found.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isSelected = productInfo.selectedCategories.includes(cat.name);
                    return (
                      <button key={cat.id} type="button" onClick={() => toggleCategory(cat.name)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                      >
                        {isSelected && <span className="mr-1">✓</span>}{cat.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Optional sections toggle bar (only in add mode) */}
          {/* {!isEditMode && (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-400 font-medium self-center mr-1">Optional:</span>
              <SectionToggle show={showDescription}  onToggle={() => setShowDescription((v) => !v)}  label="Description" />
              <SectionToggle show={showMrp}          onToggle={() => setShowMrp((v) => !v)}          label="MRP" />
              <SectionToggle show={showImages}       onToggle={() => setShowImages((v) => !v)}       label="Images" />
              <SectionToggle show={showKeyFeatures}  onToggle={() => setShowKeyFeatures((v) => !v)}  label="Key Features" />
              <SectionToggle show={showCategories}   onToggle={() => setShowCategories((v) => !v)}   label="Categories" />
            </div>
          )} */}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            {isEditMode && (
              <button type="button" onClick={() => router.push('/store/manage-product')} className="px-6 py-3 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all">
                Cancel
              </button>
            )}
            <button type="submit" disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> {isEditMode ? 'Saving...' : 'Adding Product...'}</>
                : isEditMode
                  ? <><Pencil size={18} /> Save Changes</>
                  : <><PlusCircle size={18} /> Add Product</>}
            </button>
          </div>
        </form>
      </div>

      {showAddModal && (
  <AddVariantModal
    existingLabels={variantList.map((v) => v.label)}
    globalSizes={storeGlobalSizes}
    onAdd={addVariant}
    onClose={() => setShowAddModal(false)}
  />
)}
    </div>
  );
}