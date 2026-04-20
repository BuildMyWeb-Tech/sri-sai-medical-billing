// C:\Users\Siddharathan\Desktop\gocart-ecommerce-full-stack\app\(public)\layout.jsx
'use client'
import Banner from "@/components/Banner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProducts } from "@/lib/features/product/productSlice";
import { useUser, useAuth } from "@clerk/nextjs";

// ✅ Correct thunk imports
import { fetchCartThunk, uploadCartThunk } from "@/lib/features/cart/cartSlice";
import { fetchAddress } from "@/lib/features/address/addressSlice";
import { fetchUserRatings } from "@/lib/features/rating/ratingSlice";

export default function PublicLayout({ children }) {

    const dispatch = useDispatch()
    const { user } = useUser()
    const { getToken } = useAuth()

    const { items } = useSelector((state) => state.cart)

    // Fetch products on load
    useEffect(() => {
        dispatch(fetchProducts({}))
    }, [])

    // Fetch cart + address + ratings when user logs in
    useEffect(() => {
        if (user) {
            dispatch(fetchCartThunk({ getToken }))
            dispatch(fetchAddress({ getToken }))
            dispatch(fetchUserRatings({ getToken }))
        }
    }, [user])

    // Upload cart to backend when cart updates
    useEffect(() => {
        if (user) {
            dispatch(uploadCartThunk({ getToken }))
        }
    }, [items])

    return (
        <>
            <Banner />
            <Navbar />
            {children}
            <Footer />
        </>
    );
}
