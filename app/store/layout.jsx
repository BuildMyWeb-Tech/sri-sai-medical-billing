// app/store/layout.jsx
import StoreLayout from '@/components/store/StoreLayout';

export const metadata = {
    title: "Sri Sai Medical Surgical Store",
  description: 'Sri Sai Medical Surgical Store - Store Dashboard',
};

// No more SignedIn/SignedOut split.
// StoreLayout handles BOTH Clerk owners AND employee JWT internally.
export default function RootStoreLayout({ children }) {
  return <StoreLayout>{children}</StoreLayout>;
}
