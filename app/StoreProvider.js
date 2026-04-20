// app/StoreProvider.js
'use client';

import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '@/lib/store';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchCartThunk } from '@/lib/features/cart/cartSlice';

// ─── Syncs Clerk user → DB and loads cart on sign-in ───
// Calling GET /api/cart triggers ensureUserExists inside the route,
// which upserts the user row — no separate webhook or syncUser needed.
function UserBootstrapper() {
  const { isSignedIn, getToken } = useAuth();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isSignedIn) return;
    // This single call:
    // 1. Creates the DB user row if it doesn't exist (via ensureUserExists in cart route)
    // 2. Loads the user's saved cart into Redux state
    dispatch(fetchCartThunk({ getToken }));
  }, [isSignedIn]);

  return null;
}

export default function StoreProvider({ children }) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <UserBootstrapper />
        <Toaster position="top-center" />
        {children}
      </PersistGate>
    </Provider>
  );
}
