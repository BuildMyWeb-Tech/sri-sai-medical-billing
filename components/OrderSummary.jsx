// C:\Users\Siddharathan\Desktop\gocart-ecommerce-full-stack\components\OrderSummary.jsx
import { PlusIcon, SquarePenIcon, XIcon, CheckCircleIcon, ClockIcon, ShieldCheckIcon, CreditCardIcon, TrendingDown } from 'lucide-react';
import React, { useState } from 'react'
import AddressModal from './AddressModal';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Protect, useAuth, useUser } from '@clerk/nextjs'
import axios from 'axios';
import { fetchCartThunk } from '@/lib/features/cart/cartSlice';

// Order Summary Component
const OrderSummary = ({ totalPrice, items, appliedCoupon = null, discount = 0 }) => {
    const dispatch = useDispatch();
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';
    const router = useRouter();

    const addressList = useSelector(state => state.address?.list || []);

    const [paymentMethod, setPaymentMethod] = useState('COD');
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const { user } = useUser();
    const { getToken } = useAuth();

    const handlePlaceOrder = async (e) => {
        e.preventDefault();
        try {
            if (!user) {
                return toast('Please login to place an order');
            }
            if (!selectedAddress) {
                return toast('Please select an address');
            }
            const token = await getToken();

            const orderData = {
                addressId: selectedAddress.id,
                items,
                paymentMethod
            };

            // Include coupon code if applied
            if (appliedCoupon) {
                orderData.couponCode = appliedCoupon.code;
            }
            
            // Create order
            const { data } = await axios.post('/api/orders', orderData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (paymentMethod === 'STRIPE') {
                window.location.href = data.session.url;
            } else {
                toast.success(data.message);
                router.push('/orders');
                dispatch(fetchCartThunk({ getToken }));  // Updated to use fetchCartThunk
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message);
        }
    };

    return (
        <div className='w-full max-w-lg lg:max-w-[340px] bg-white border border-slate-200 text-slate-500 text-sm rounded-xl shadow-sm overflow-hidden sticky top-4'>
            {/* Order Summary Header */}
            <div className="bg-slate-50 p-5 border-b border-slate-100">
                <h2 className='text-xl font-semibold text-slate-700'>Order Summary</h2>
            </div>

            <div className="p-5">
                {/* Payment Method Section */}
                <div className="mb-6">
                    <p className='text-slate-700 font-medium mb-3'>Payment Method</p>
                    <div className='flex flex-col gap-3'>
                        <label 
                            htmlFor="COD" 
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === 'COD' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:bg-slate-50'}`}
                        >
                            <input 
                                type="radio" 
                                id="COD" 
                                onChange={() => setPaymentMethod('COD')} 
                                checked={paymentMethod === 'COD'} 
                                className='accent-green-500 size-4'
                            />
                            <div>
                                <p className="font-medium text-slate-800">Cash On Delivery</p>
                                <p className="text-xs text-slate-500">Pay when you receive your items</p>
                            </div>
                        </label>
                        
                        <label 
                            htmlFor="STRIPE" 
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMethod === 'STRIPE' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:bg-slate-50'}`}
                        >
                            <input 
                                type="radio" 
                                id="STRIPE" 
                                name='payment' 
                                onChange={() => setPaymentMethod('STRIPE')} 
                                checked={paymentMethod === 'STRIPE'} 
                                className='accent-green-500 size-4'
                            />
                            <div>
                                <p className="font-medium text-slate-800">Card Payment</p>
                                <p className="text-xs text-slate-500">Secure online payment via Stripe</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Address Section */}
                <div className='my-6 py-4 border-y border-slate-200'>
                    <p className='text-slate-700 font-medium mb-3'>Delivery Address</p>
                    {selectedAddress ? (
                        <div className='flex items-start gap-3 p-3 bg-slate-50 rounded-lg'>
                            <div className="bg-slate-200 text-slate-500 rounded-full p-1 mt-1">
                                <CheckCircleIcon size={16} />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-slate-700">{selectedAddress.name}</p>
                                <p className="text-sm text-slate-600 mt-1">{selectedAddress.city}, {selectedAddress.state}, {selectedAddress.zip}</p>
                                <button 
                                    onClick={() => setSelectedAddress(null)} 
                                    className="flex items-center gap-1 text-xs text-green-600 mt-2 hover:text-green-700 transition-colors"
                                >
                                    <SquarePenIcon size={14} /> Change address
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {addressList.length > 0 && (
                                <select 
                                    className='border border-slate-200 p-3 w-full my-3 outline-none rounded-lg focus:border-green-500 transition-colors' 
                                    onChange={(e) => setSelectedAddress(addressList[e.target.value])}
                                >
                                    <option value="">Select Delivery Address</option>
                                    {addressList.map((address, index) => (
                                        <option key={index} value={index}>
                                            {address.name}, {address.city}, {address.state}, {address.zip}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <button 
                                className='flex items-center gap-1 text-green-600 mt-1 hover:text-green-700 transition-colors py-1' 
                                onClick={() => setShowAddressModal(true)}
                            >
                                <PlusIcon size={18} /> Add New Address
                            </button>
                        </div>
                    )}
                </div>

                {/* Price Breakdown */}
                <div className='pb-4 border-b border-slate-200'>
                    <div className='flex justify-between mb-4'>
                        <div className='flex flex-col gap-2 text-slate-600'>
                            <p>Subtotal:</p>
                            <p>Shipping:</p>
                            {appliedCoupon && (
                                <p className="text-green-600 font-medium flex items-center gap-1">
                                    <TrendingDown size={14} />
                                    Discount ({appliedCoupon.discount}%):
                                </p>
                            )}
                        </div>
                        <div className='flex flex-col gap-2 font-medium text-right'>
                            <p>₹ {totalPrice.toLocaleString()}</p>
                            <p>
                                <Protect 
                                    plan={'plus'} 
                                    fallback={
                                        <span className="text-slate-700">₹ 5</span>
                                    }
                                >
                                    <span className="text-green-600">Free</span>
                                </Protect>
                            </p>
                            {appliedCoupon && (
                                <p className="text-green-600">- ₹ {discount.toFixed(2)}</p>
                            )}
                        </div>
                    </div>
                    
                    {/* Applied Coupon Badge */}
                    {appliedCoupon && (
                        <div className='w-full flex items-center gap-2 bg-green-50 border border-green-100 p-2.5 rounded-lg mt-2'>
                            <div className="bg-green-500/10 text-green-600 rounded-full p-1">
                                <CheckCircleIcon size={14} />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-medium text-green-700">
                                    Coupon: <span className='font-semibold'>{appliedCoupon.code}</span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Total & Place Order */}
                <div className='py-4'>
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-lg font-semibold text-slate-700">Total:</p>
                        <p className='text-xl font-bold text-slate-800'>
                            <Protect 
                                plan={'plus'} 
                                fallback={`₹ ${(totalPrice + 5 - discount).toFixed(2)}`}
                            >  
                                ₹ {(totalPrice - discount).toFixed(2)}
                            </Protect>
                        </p>
                    </div>

                    <button 
                        onClick={e => toast.promise(handlePlaceOrder(e), { loading: 'Placing Order...' })} 
                        className='w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 active:scale-98 transition-all font-medium shadow-sm'
                    >
                        Place Order
                    </button>
                    
                    {/* Trust badges */}
                    <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                            <ShieldCheckIcon size={14} />
                            <span>Secure Payment</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                            <ClockIcon size={14} />
                            <span>24/7 Support</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {showAddressModal && <AddressModal setShowAddressModal={setShowAddressModal} />}
        </div>
    );
};

export default OrderSummary