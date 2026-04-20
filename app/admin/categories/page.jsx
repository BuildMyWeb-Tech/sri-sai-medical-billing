// app/admin/categories/page.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import {
  LayersIcon,
  PlusCircle,
  Trash2,
  Loader2,
  UploadCloud,
  X,
  AlertTriangle,
  ImageIcon,
  Pencil,
  ChevronLeft,
  Upload,
  Globe,
  Store,
  PackageSearch,
  CheckSquare,
  Square,
} from 'lucide-react';

export default function AdminCategoriesPage() {
  const { getToken } = useAuth();
  const fileInputRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Delete state
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: '' });
  const [depLoading, setDepLoading] = useState(false);
  const [depInfo, setDepInfo] = useState(null); // { affectedCount, affectedProducts }
  const [deleteProducts, setDeleteProducts] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await axios.get('/api/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(data.categories || []);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm({ name: '', description: '' });
    clearImage();
    setShowForm(true);
  };

  const openEditForm = (cat) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, description: cat.description });
    setImageFile(null);
    setImagePreview(cat.image);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: '', description: '' });
    clearImage();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingId && !imageFile) {
      toast.error('Please upload a category image');
      return;
    }
    try {
      setSubmitting(true);
      const token = await getToken();
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      if (imageFile) fd.append('image', imageFile);

      if (editingId) {
        fd.append('id', editingId);
        const { data } = await axios.put('/api/categories', fd, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success(data.message || 'Category updated!');
        setCategories((prev) => prev.map((c) => (c.id === editingId ? data.category : c)));
      } else {
        const { data } = await axios.post('/api/categories', fd, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success(data.message || 'Category created!');
        setCategories((prev) => [data.category, ...prev]);
      }
      closeForm();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open delete → fetch dependency info first ─────────────────
  const openDelete = async (cat) => {
    setDeleteModal({ open: true, id: cat.id, name: cat.name });
    setDepInfo(null);
    setDeleteProducts(false);
    setDepLoading(true);
    try {
      const token = await getToken();
      const { data } = await axios.get(`/api/categories?checkOnly=true&id=${cat.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDepInfo(data);
    } catch {
      toast.error('Failed to check product dependencies');
    } finally {
      setDepLoading(false);
    }
  };

  const closeDelete = () => {
    setDeleteModal({ open: false, id: null, name: '' });
    setDepInfo(null);
    setDeleteProducts(false);
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const token = await getToken();
      const { data } = await axios.delete('/api/categories', {
        headers: { Authorization: `Bearer ${token}` },
        data: { id: deleteModal.id, deleteProducts },
      });
      setCategories((prev) => prev.filter((c) => c.id !== deleteModal.id));
      toast.success(data.message || 'Category deleted');
      closeDelete();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const ScopeBadge = ({ cat }) => {
    const isGlobal = cat.createdBy === 'ADMIN';
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${isGlobal ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}
      >
        {isGlobal ? (
          <>
            <Globe size={11} /> Global
          </>
        ) : (
          <>
            <Store size={11} /> {cat.store?.name || 'Store'}
          </>
        )}
      </span>
    );
  };

  // ── Form View ─────────────────────────────────────────────────
  if (showForm) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={closeForm}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-600"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  {editingId ? (
                    <>
                      <Pencil size={18} className="text-indigo-500" /> Edit Category
                    </>
                  ) : (
                    <>
                      <PlusCircle size={18} className="text-green-500" /> Add Global Category
                    </>
                  )}
                </h2>
              </div>
              <button
                onClick={closeForm}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Image */}
              <div>
                <p className="text-sm font-medium text-slate-600 mb-2">
                  Category Image{!editingId && <span className="text-red-500 ml-1">*</span>}
                  {editingId && (
                    <span className="text-slate-400 text-xs ml-2">
                      (leave blank to keep current)
                    </span>
                  )}
                </p>
                <div className="flex items-start gap-4">
                  <div
                    className="relative w-36 h-36 rounded-xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer group hover:border-green-400 transition-colors flex-shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <>
                        <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Upload size={20} className="text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <UploadCloud size={24} />
                        <span className="text-xs text-center px-2">Click to upload</span>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </div>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={clearImage}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 mt-1 px-3 py-1.5 border border-red-100 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={12} /> Remove image
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-600">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Electronics"
                  className="p-2.5 px-3 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-green-100 text-sm"
                  required
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-600">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description"
                  rows={3}
                  className="p-2.5 px-3 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-green-100 text-sm resize-none"
                  required
                />
              </div>

              {!editingId && (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg p-3 text-sm text-purple-700">
                  <Globe size={16} className="text-purple-500 flex-shrink-0" />
                  <p>
                    This category will be <strong>global</strong> — visible to all stores and users.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="px-5 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-6 py-2.5 rounded-lg text-white text-sm font-medium flex items-center gap-2 disabled:opacity-60 transition-colors ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : editingId ? (
                    <>
                      <Pencil size={16} /> Save Changes
                    </>
                  ) : (
                    <>
                      <PlusCircle size={16} /> Create Category
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── List View ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
              <LayersIcon size={22} className="text-green-600" /> Category Management
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Admin creates <span className="text-purple-600 font-medium">Global</span> categories
              visible everywhere. Stores can also create{' '}
              <span className="text-blue-600 font-medium">Store-scoped</span> categories.
            </p>
          </div>
          <button
            onClick={openAddForm}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <PlusCircle size={16} /> Add Global Category
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">All Categories</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                {categories.filter((c) => c.createdBy === 'ADMIN').length} Global
              </span>
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                {categories.filter((c) => c.createdBy === 'STORE').length} Store
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <LayersIcon size={40} className="mb-3 text-slate-300" />
              <p className="font-medium">No categories yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3.5 font-medium text-slate-500">Image</th>
                    <th className="text-left px-5 py-3.5 font-medium text-slate-500">Name</th>
                    <th className="text-left px-5 py-3.5 font-medium text-slate-500 hidden md:table-cell">
                      Description
                    </th>
                    <th className="text-left px-5 py-3.5 font-medium text-slate-500">Scope</th>
                    <th className="text-left px-5 py-3.5 font-medium text-slate-500 hidden sm:table-cell">
                      Date
                    </th>
                    <th className="text-center px-5 py-3.5 font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, idx) => (
                    <tr
                      key={cat.id}
                      className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${idx === categories.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                          {cat.image ? (
                            <Image src={cat.image} alt={cat.name} fill className="object-cover" />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <ImageIcon size={16} className="text-slate-300" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-800">{cat.name}</td>
                      <td className="px-5 py-4 text-slate-500 hidden md:table-cell max-w-xs">
                        <p className="line-clamp-2">{cat.description}</p>
                      </td>
                      <td className="px-5 py-4">
                        <ScopeBadge cat={cat} />
                      </td>
                      <td className="px-5 py-4 text-slate-400 text-xs hidden sm:table-cell">
                        {new Date(cat.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditForm(cat)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => openDelete(cat)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Modal with dependency check ─────────────────── */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={closeDelete}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 z-10">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Delete Category</h3>
                <p className="text-slate-500 text-sm mt-1">
                  Deleting <span className="font-medium text-slate-700">"{deleteModal.name}"</span>
                </p>
              </div>
            </div>

            {/* Dependency info */}
            {depLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
                <Loader2 size={16} className="animate-spin" /> Checking product dependencies...
              </div>
            ) : depInfo ? (
              depInfo.affectedCount === 0 ? (
                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2 mb-4">
                  <PackageSearch size={16} className="text-green-500" />
                  No products use this category. Safe to delete.
                </div>
              ) : (
                <div className="mb-4 space-y-3">
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800">
                    <p className="font-medium mb-1 flex items-center gap-1.5">
                      <PackageSearch size={15} /> {depInfo.affectedCount} product(s) use this
                      category:
                    </p>
                    <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5 max-h-28 overflow-y-auto">
                      {depInfo.affectedProducts.map((p) => (
                        <li key={p.id}>
                          {p.name} <span className="text-amber-500">({p.scope})</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Checkbox choice */}
                  <p className="text-sm font-medium text-slate-700">
                    What should happen to these products?
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setDeleteProducts(false)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-sm text-left transition-colors ${!deleteProducts ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                    >
                      {!deleteProducts ? (
                        <CheckSquare size={18} className="text-blue-500 flex-shrink-0" />
                      ) : (
                        <Square size={18} className="text-slate-400 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium">Only delete category</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Products will remain but lose this category tag
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteProducts(true)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-sm text-left transition-colors ${deleteProducts ? 'border-red-400 bg-red-50 text-red-800' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                    >
                      {deleteProducts ? (
                        <CheckSquare size={18} className="text-red-500 flex-shrink-0" />
                      ) : (
                        <Square size={18} className="text-slate-400 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium">
                          Delete category AND all {depInfo.affectedCount} product(s)
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Permanently removes both the category and the products
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )
            ) : null}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={closeDelete}
                disabled={deleting}
                className="px-4 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting || depLoading}
                className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium flex items-center gap-2 disabled:opacity-60 transition-colors ${deleteProducts ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />{' '}
                    {deleteProducts ? 'Delete Category + Products' : 'Delete Category Only'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
