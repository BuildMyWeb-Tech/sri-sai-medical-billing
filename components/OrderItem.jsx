// components/OrderItem.jsx
'use client';
import Image from 'next/image';
import { useSelector } from 'react-redux';
import Rating from './Rating';
import { useState } from 'react';
import RatingModal from './RatingModal';
import OrderStatusTracker from './OrderStatusTracker';
import OrderTimeline from './OrderTimeline';
import { History, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_LABELS = {
  ORDER_PLACED: 'Order Placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return Requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
};

const STATUS_COLORS = {
  ORDER_PLACED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-violet-100 text-violet-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  SHIPPED: 'bg-cyan-100 text-cyan-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  RETURN_REQUESTED: 'bg-orange-100 text-orange-700',
  RETURNED: 'bg-purple-100 text-purple-700',
  REFUNDED: 'bg-teal-100 text-teal-700',
};

const OrderItem = ({ order }) => {
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';
  const [ratingModal, setRatingModal] = useState(null);
  const [showTracker, setShowTracker] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const { ratings } = useSelector((state) => state.rating);

  const statusLabel = STATUS_LABELS[order.status] || order.status?.replace(/_/g, ' ');
  const statusColor = STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-700';

  return (
    <>
      <tr className="text-sm">
        {/* Products */}
        <td className="text-left">
          <div className="flex flex-col gap-6">
            {order.orderItems.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-20 aspect-square bg-slate-100 flex items-center justify-center rounded-md flex-shrink-0">
                  <Image
                    className="h-14 w-auto"
                    src={item.product.images[0]}
                    alt="product_img"
                    width={50}
                    height={50}
                  />
                </div>
                <div className="flex flex-col justify-center text-sm">
                  <p className="font-medium text-slate-600 text-base">{item.product.name}</p>
                  <p>
                    {currency}
                    {item.price} &nbsp;·&nbsp; Qty: {item.quantity}
                  </p>
                  <p className="mb-1 text-slate-400 text-xs">
                    {new Date(order.createdAt).toDateString()}
                  </p>
                  <div>
                    {ratings.find(
                      (r) => order.id === r.orderId && item.product.id === r.productId
                    ) ? (
                      <Rating
                        value={
                          ratings.find(
                            (r) => order.id === r.orderId && item.product.id === r.productId
                          ).rating
                        }
                      />
                    ) : (
                      <button
                        onClick={() =>
                          setRatingModal({ orderId: order.id, productId: item.product.id })
                        }
                        className={`text-green-500 hover:bg-green-50 transition text-xs px-2 py-1 rounded ${order.status !== 'DELIVERED' && 'hidden'}`}
                      >
                        Rate Product
                      </button>
                    )}
                  </div>
                  {ratingModal && (
                    <RatingModal ratingModal={ratingModal} setRatingModal={setRatingModal} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </td>

        {/* Total */}
        <td className="text-center max-md:hidden">
          {currency}
          {order.total}
        </td>

        {/* Address */}
        <td className="text-left max-md:hidden">
          <p>
            {order.address.name}, {order.address.street},
          </p>
          <p>
            {order.address.city}, {order.address.state}, {order.address.zip},{' '}
            {order.address.country},
          </p>
          <p>{order.address.phone}</p>
        </td>

        {/* Status */}
        <td className="text-left space-y-2 text-sm max-md:hidden">
          <div>
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${statusColor}`}
            >
              {statusLabel}
            </span>
          </div>

          {/* Toggle tracker */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                setShowTracker(!showTracker);
                setShowTimeline(false);
              }}
              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition"
            >
              {showTracker ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showTracker ? 'Hide tracker' : 'Track order'}
            </button>
            {order.timeline?.length > 0 && (
              <button
                onClick={() => {
                  setShowTimeline(!showTimeline);
                  setShowTracker(false);
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition"
              >
                <History size={12} />
                {showTimeline ? 'Hide history' : `History (${order.timeline.length})`}
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* ── Status Tracker Row (expandable) ───────────────── */}
      {showTracker && (
        <tr>
          <td colSpan={4} className="px-4 py-2 bg-slate-50">
            <div className="max-w-xl">
              <OrderStatusTracker status={order.status} />
            </div>
          </td>
        </tr>
      )}

      {/* ── Timeline Row (expandable) ─────────────────────── */}
      {showTimeline && (
        <tr>
          <td colSpan={4} className="px-4 py-3 bg-slate-50">
            <div className="max-w-md">
              <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1">
                <History size={12} /> Order Timeline
              </p>
              <OrderTimeline timeline={order.timeline || []} />
            </div>
          </td>
        </tr>
      )}

      {/* ── Mobile Status ──────────────────────────────────── */}
      <tr className="md:hidden">
        <td colSpan={5}>
          <p>
            {order.address.name}, {order.address.street}
          </p>
          <p>
            {order.address.city}, {order.address.state}, {order.address.zip},{' '}
            {order.address.country}
          </p>
          <p>{order.address.phone}</p>
          <br />
          <div className="flex items-center justify-center">
            <span className={`px-6 py-1.5 rounded text-xs font-semibold ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          {/* Mobile tracker toggle */}
          <div className="mt-2 flex justify-center">
            <button
              onClick={() => setShowTracker(!showTracker)}
              className="text-xs text-blue-500 flex items-center gap-1"
            >
              {showTracker ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showTracker ? 'Hide tracker' : 'Track order'}
            </button>
          </div>
        </td>
      </tr>

      {showTracker && (
        <tr className="md:hidden">
          <td colSpan={5} className="px-2 py-2 bg-slate-50">
            <OrderStatusTracker status={order.status} />
          </td>
        </tr>
      )}

      <tr>
        <td colSpan={4}>
          <div className="border-b border-slate-300 w-6/7 mx-auto" />
        </td>
      </tr>
    </>
  );
};

export default OrderItem;
