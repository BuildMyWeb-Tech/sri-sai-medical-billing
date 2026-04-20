// lib/store.js
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import storage from 'redux-persist/lib/storage';
import { persistReducer, persistStore } from 'redux-persist';

import cartReducer from './features/cart/cartSlice';
import wishlistReducer from './features/wishlist/wishlistSlice';
import productReducer from './features/product/productSlice';
import addressReducer from './features/address/addressSlice';
import ratingReducer from './features/rating/ratingSlice';

// ---------------------------------------------
// 1️⃣ Combine Reducers
// ---------------------------------------------
const rootReducer = combineReducers({
    cart: cartReducer,
    wishlist: wishlistReducer,
    product: productReducer,
    address: addressReducer,
    rating: ratingReducer,
});

// ---------------------------------------------
// 2️⃣ redux-persist Config
// ---------------------------------------------
const persistConfig = {
    key: 'root',
    storage,
    whitelist: ['cart', 'wishlist'], // persist only these
};

// Wrap reducers with persist
const persistedReducer = persistReducer(persistConfig, rootReducer);

// ---------------------------------------------
// 3️⃣ Manual LocalStorage Backup (optional)
// ---------------------------------------------
// Load state manually (fallback)
const loadState = () => {
    try {
        const serializedState = localStorage.getItem('redux-backup');
        if (!serializedState) return undefined;
        return JSON.parse(serializedState);
    } catch {
        return undefined;
    }
};

// Save state manually (backup)
const saveState = (state) => {
    try {
        const serializedState = JSON.stringify(state);
        localStorage.setItem('redux-backup', serializedState);
    } catch (err) {
        console.log("Backup save error:", err);
    }
};

// ---------------------------------------------
// 4️⃣ Create Store
// ---------------------------------------------
export const store = configureStore({
    reducer: persistedReducer,
    preloadedState: typeof window !== "undefined" ? loadState() : undefined,
    middleware: (getDefault) =>
        getDefault({
            serializableCheck: false,
        }),
});

// ---------------------------------------------
// 5️⃣ Subscribe store → Save backup only
// ---------------------------------------------
if (typeof window !== "undefined") {
    store.subscribe(() => {
        saveState({
            cart: store.getState().cart,
            wishlist: store.getState().wishlist,
        });
    });
}

// ---------------------------------------------
// 6️⃣ Persistor
// ---------------------------------------------
export const persistor = persistStore(store);