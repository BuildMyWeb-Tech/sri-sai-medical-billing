// components/store/StoreSidebar.jsx
'use client';
import { usePathname, useRouter } from 'next/navigation';
import {
  HomeIcon,
  LayoutListIcon,
  SquarePenIcon,
  SquarePlusIcon,
  BarChart2,
  ShoppingBag,
  Settings,
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Package,
  Users,
  LogOut,
  Receipt,
  IndianRupee
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const ALL_LINKS = [
  { name: 'Dashboard', href: '/store', icon: HomeIcon, permission: null },
  {
    name: 'Product Categories',
    href: '/store/categories',
    icon: LayoutListIcon,
    permission: 'inventory',
  },
  {
    name: 'Add Product',
    href: '/store/add-product',
    icon: SquarePlusIcon,
    permission: 'inventory',
  },
  {
    name: 'Manage Products',
    href: '/store/manage-product',
    icon: SquarePenIcon,
    permission: 'inventory',
  },
  { name: 'Inventory', href: '/store/inventory', icon: Package, permission: 'inventory' },
  { name: 'POS Billing', href: '/store/billing', icon: IndianRupee, permission: 'orders' },
  // { name: 'Orders', href: '/store/orders', icon: ShoppingBag, permission: 'orders' },
  { name: 'Sales Report', href: '/store/analytics', icon: BarChart2, permission: 'reports' },
  { name: 'Employees', href: '/store/employees', icon: Users, permission: 'settings' },
  { name: 'Store Settings', href: '/store/settings', icon: Settings, permission: 'settings' },
  // { name: 'Help & Support', href: '/store/help', icon: HelpCircle, permission: null },
];

const StoreSidebar = ({ storeInfo, closeMobileMenu, employee }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const isOwner = !employee || employee.role === 'STORE_OWNER';

  const visibleLinks = ALL_LINKS.filter((link) => {
    if (!link.permission) return true;
    if (isOwner) return true;
    return employee?.permissions?.[link.permission] === true;
  });

  const handleLinkClick = () => {
    if (closeMobileMenu) closeMobileMenu();
  };

  const handleLogout = () => {
    localStorage.removeItem('employeeToken');
    localStorage.removeItem('employeeData');
    router.push('/store/login');
  };

  return (
    <div
      className={`inline-flex h-full flex-col border-r border-slate-200 bg-white shadow-sm transition-all relative ${collapsed ? 'sm:w-20' : 'sm:min-w-64'} w-72`}
    >
      {/* Mobile close */}
      <div className="flex justify-between items-center p-4 md:hidden border-b border-slate-100">
        <p className="font-medium text-slate-800">Menu</p>
        <button
          onClick={closeMobileMenu}
          className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
        >
          <X size={20} />
        </button>
      </div>

      {/* Store profile */}
      <div
        className={`flex ${collapsed ? 'flex-col' : 'flex-row'} gap-3 items-center pt-6 px-4 pb-2`}
      >
        <div className="relative flex-shrink-0">
          {storeInfo?.logo ? (
            <Image
              className="w-12 h-12 rounded-full shadow-md border-2 border-white object-cover"
              src={storeInfo.logo}
              alt={storeInfo?.name || 'Store'}
              width={48}
              height={48}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold text-lg shadow-md">
              {storeInfo?.name?.charAt(0)?.toUpperCase() || 'S'}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
        </div>

        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-slate-800 font-medium truncate text-sm">{storeInfo?.name}</p>
            {employee ? (
              <div className="flex flex-col gap-0.5 mt-0.5">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full w-fit font-medium ${
                    isOwner ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {isOwner ? 'Store Owner' : 'Employee'}
                </span>
                <span className="text-xs text-slate-400 truncate">{employee.name}</span>
              </div>
            ) : (
              <span className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 hidden md:block flex-shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto pt-2 pb-2">
        {visibleLinks.map((link) => {
          const isBilling = link.href === '/store/billing';
          const isActive =
            link.href === '/store' ? pathname === '/store' : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleLinkClick}
              className={`relative flex items-center gap-3 p-2.5 transition-all hover:bg-slate-50 ${
                collapsed ? 'justify-center' : 'pl-6 pr-3'
              } ${
                isActive
                  ? 'bg-gradient-to-r from-slate-50 to-slate-100 font-medium text-slate-800'
                  : 'text-slate-500 hover:text-slate-600'
              }`}
            >
              <link.icon
                size={18}
                className={isActive ? 'text-green-500' : isBilling ? 'text-amber-500' : ''}
              />
              {!collapsed && (
                <p className="truncate text-sm flex items-center gap-2">
                  {link.name}
                  {isBilling && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold leading-none">
                      POS
                    </span>
                  )}
                </p>
              )}
              {isActive && (
                <span className="absolute bg-gradient-to-b from-green-400 to-green-600 right-0 top-0 bottom-0 w-1.5 rounded-l" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Logout — only for employee JWT sessions */}
      {employee && (
        <div className="border-t border-slate-100 p-3">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors text-sm ${
              collapsed ? 'justify-center' : 'pl-3'
            }`}
          >
            <LogOut size={16} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      )}
    </div>
  );
};

export default StoreSidebar;
