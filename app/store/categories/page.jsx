// app/store/categories/page.jsx
'use client';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  AlertTriangle,
  ChevronLeft,
  Globe,
  ImagePlus,
  Info,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  PlusCircle,
  Search,
  Store,
  Trash2,
  Upload,
  X,
  PackageSearch,
  CheckSquare,
  Square,
} from 'lucide-react';

export default function StoreCategoriesPage() {
  const { getToken } = useAuth();
  const fileInputRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
const [imageFile, setImageFile] = useState(null);
const [imagePreview, setImagePreview] = useState(null);
const [duplicateWarning, setDuplicateWarning] = useState(false);
  // Delete state
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: '' });
  const [depLoading, setDepLoading] = useState(false);
  const [depInfo, setDepInfo] = useState(null);
  const [deleteProducts, setDeleteProducts] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = async () => {
    try {
      setPageLoading(true);
      const token = await getToken();
      const { data } = await axios.get('/api/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(data.categories || []);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Store can only edit/delete their OWN store categories
  const canModify = (cat) => cat.createdBy === 'STORE';

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormData({ name: '', description: '' });
    clearImage();
    setShowForm(true);
  };

  const openEditForm = (cat) => {
    if (!canModify(cat)) {
      toast.error('You cannot edit global admin categories');
      return;
    }
    setEditingId(cat.id);
    setFormData({ name: cat.name, description: cat.description });
    setImageFile(null);
    setImagePreview(cat.image);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(true);
  };

 const closeForm = () => {
  setShowForm(false);
  setEditingId(null);
  setFormData({ name: '', description: '' });
  setDuplicateWarning(false);
  clearImage();
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const token = await getToken();
      const fd = new FormData();
      fd.append('name', formData.name);
      fd.append('description', formData.description);
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

  const openDelete = async (cat) => {
    if (!canModify(cat)) {
      toast.error('You cannot delete global admin categories');
      return;
    }
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
      toast.error('Failed to check dependencies');
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
        className={` ${isGlobal ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}
      >
        {isGlobal ? (
          <>
            {/* <Globe size={10} /> Global */}
          </>
        ) : (
          <>
            {/* <Store size={10} /> Mine */}
          </>
        )}
      </span>
    );
  };

  // ── Form ──────────────────────────────────────────────────────
  if (showForm) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={closeForm}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-600"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {editingId ? (
                  <>
                    <Pencil size={18} className="text-indigo-500" /> Edit Category
                  </>
                ) : (
                  <>
                    <PlusCircle size={18} className="text-green-500" /> Add Category
                  </>
                )}
              </h2>
            </div>
            <button
              onClick={closeForm}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Image */}
            <div className="md:col-span-1">
             <label className="block text-sm font-medium text-slate-700 mb-2">
  Category Image{' '}
  <span className="text-slate-400 text-xs font-normal">(optional)</span>
</label>
              <div
                className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center h-48 relative overflow-hidden cursor-pointer group hover:border-green-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <>
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      fill
                      className="object-cover group-hover:opacity-80 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <div className="bg-white rounded-full p-2.5 shadow-md">
                        <Upload size={20} className="text-green-600" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-green-50 p-3 rounded-full mb-2 text-green-500">
                      <ImagePlus size={28} />
                    </div>
                    <p className="text-slate-700 text-sm font-medium">Upload image</p>
                    <p className="text-slate-500 text-xs mt-1">Click to browse</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              {imagePreview && (
                <button
                  type="button"
                  onClick={clearImage}
                  className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                >
                  <X size={12} /> Remove image
                </button>
              )}
            </div>

            {/* Fields */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
  type="text"
  value={formData.name}
  onChange={(e) => {
    const val = e.target.value;
    setFormData({ ...formData, name: val });
    const isDuplicate = categories.some(
      (c) => c.name.toLowerCase() === val.trim().toLowerCase() && c.id !== editingId
    );
    setDuplicateWarning(isDuplicate);
  }}
  placeholder="e.g. Electronics"
  className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 bg-slate-50 ${
    duplicateWarning
      ? 'border-amber-400 focus:ring-amber-100'
      : 'border-slate-200 focus:ring-green-100'
  }`}
  required
/>
{duplicateWarning && (
  <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-1.5">
    <AlertTriangle size={12} /> A category with this name already exists.
  </p>
)}
              </div>
              <div>
               <label className="block text-sm font-medium text-slate-700 mb-2">
  Description{' '}
  <span className="text-slate-400 text-xs font-normal">(optional)</span>
</label>
<textarea
  value={formData.description}
  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
  placeholder="Describe this category..."
  rows={4}
  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-100 bg-slate-50 resize-none"
/>
              </div>
              {/* {!editingId && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
                  <Store size={16} className="text-blue-500 flex-shrink-0" />
                  <p>
                    This will be a <strong>store-scoped</strong> category — visible to your store
                    and its customers.
                  </p>
                </div>
              )} */}
            </div>

            <div className="md:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
  disabled={submitting || duplicateWarning}
                className={`px-5 py-2.5 rounded-lg text-white flex items-center gap-1.5 text-sm font-medium disabled:opacity-70 transition-colors ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-green-600 hover:bg-green-700'}`}
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
                    <PlusCircle size={16} /> Add Category
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── List View ─────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl text-slate-800 font-bold flex items-center gap-2">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <Layers size={24} />
            </div>
            Product Categories
          </h1>
          {/* <p className="text-slate-500 text-sm mt-1">
            <span className="text-purple-600 font-medium">Global</span> = admin categories
            (read-only). <span className="text-blue-600 font-medium">Mine</span> = your store
            categories (editable).
          </p> */}
        </div>
        <button
          onClick={openAddForm}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <PlusCircle size={18} /> Add Category
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-3">
          <div className="relative flex-grow max-w-md">
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-100 bg-slate-50"
            />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="border border-slate-200 rounded-lg flex overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 ${viewMode === 'grid' ? 'bg-green-50 text-green-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 ${viewMode === 'list' ? 'bg-green-50 text-green-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {pageLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Info size={40} className="mb-3 text-slate-300" />
            <p className="font-medium text-slate-600">
              {searchTerm ? 'No results found' : 'No categories yet'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((cat) => {
              const owned = canModify(cat);
              return (
                <div
                  key={cat.id}
                  className={`border rounded-xl overflow-hidden hover:shadow-md transition-shadow group ${owned ? 'border-slate-200' : 'border-slate-100 opacity-90'}`}
                >
                  <div className="relative h-44 bg-slate-100">
  {cat.image ? (
    <Image
      src={cat.image}
      alt={cat.name}
      fill
      className="object-cover transition-transform duration-500 group-hover:scale-105"
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-slate-300">
      <Layers size={36} />
    </div>
  )}
                    <div className="absolute top-2 right-2">
                      <ScopeBadge cat={cat} />
                    </div>
                    {!owned && (
                      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-xs text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Globe size={10} /> Read only
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-slate-800 mb-1">{cat.name}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">{cat.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {new Date(cat.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {owned && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditForm(cat)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => openDelete(cat)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500">Image</th>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500">Name</th>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 hidden md:table-cell">
                    Description
                  </th>
                  {/* <th className="text-left px-5 py-3.5 font-medium text-slate-500">Scope</th> */}
                  <th className="text-center px-5 py-3.5 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat) => {
                  const owned = canModify(cat);
                  return (
                    <tr
                      key={cat.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-4">
                       <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center">
  {cat.image ? (
    <Image src={cat.image} alt={cat.name} fill className="object-cover" />
  ) : (
    <Layers size={16} className="text-slate-300" />
  )}
</div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-800">{cat.name}</td>
                      <td className="px-5 py-4 text-slate-500 hidden md:table-cell max-w-xs">
                        <p className="line-clamp-2">{cat.description}</p>
                      </td>
                      {/* <td className="px-5 py-4">
                        <ScopeBadge cat={cat} />
                      </td> */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {owned ? (
                            <>
                              <button
                                onClick={() => openEditForm(cat)}
                                className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => openDelete(cat)}
                                className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-300 flex items-center gap-1">
                              <Globe size={12} /> Read only
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700 flex items-start gap-3">
        <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <p>
          <span className="font-medium text-blue-800">Tip: </span>
          <span className="text-purple-600 font-medium">Global</span> categories (admin) are visible
          to all users. Your <span className="text-blue-600 font-medium">store</span> categories are
          visible to your store customers too.
        </p>
      </div> */}

      {/* ── Delete Modal ────────────────────────────────────────── */}
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

            {depLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
                <Loader2 size={16} className="animate-spin" /> Checking product dependencies...
              </div>
            ) : depInfo ? (
              depInfo.affectedCount === 0 ? (
                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2 mb-4">
                  <PackageSearch size={16} className="text-green-500" /> No products use this
                  category. Safe to delete.
                </div>
              ) : (
                <div className="mb-4 space-y-3">
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800">
                    <p className="font-medium mb-1 flex items-center gap-1.5">
                      <PackageSearch size={15} /> {depInfo.affectedCount} product(s) use this
                      category:
                    </p>
                    <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5 max-h-24 overflow-y-auto">
                      {depInfo.affectedProducts.map((p) => (
                        <li key={p.id}>
                          {p.name} <span className="text-amber-500">({p.scope})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
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
                          Products remain but lose this category tag
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
                          Permanently removes both the category and products
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
