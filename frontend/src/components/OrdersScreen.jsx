import { useState, useEffect } from "react";

const CANCELLABLE = ["pending", "confirmed"];

export default function OrdersScreen({ user, token, onBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const endpoint = user?.role === "deliveryman"
        ? `${import.meta.env.VITE_API_URL}/api/orders/deliveryman/mine`
        : `${import.meta.env.VITE_API_URL}/api/orders/my`;
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.data?.orders) {
        setOrders(data.data.orders);
      } else {
        setError(data.message || "Failed to load orders");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  // ── Cancel order ────────────────────────────────────────────────────
  const cancelOrder = async (orderId) => {
    setCancellingId(orderId);
    setConfirmCancelId(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: "Cancelled by customer" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not cancel order.");
      // Optimistically update status in list
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, status: "cancelled" } : o))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case "delivered":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "preparing":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "on_the_way":
      case "on-the-way":
      case "picked_up":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "cancelled":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "confirmed":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "pending":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-neutral-500/20 text-neutral-400 border-neutral-500/30";
    }
  };

  const getStatusEmoji = (status) => {
    switch(status?.toLowerCase()) {
      case "delivered":  return "✅";
      case "preparing":  return "🍳";
      case "on_the_way":
      case "on-the-way": return "🚚";
      case "picked_up":  return "🛵";
      case "cancelled":  return "❌";
      case "confirmed":  return "✔️";
      case "pending":    return "⏳";
      default:           return "⏳";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-orange-500 font-medium bg-neutral-950 absolute inset-0 rounded-[2.5rem]">
        Loading Orders...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-6 bg-neutral-950 absolute inset-0 z-50 rounded-[2.5rem]">
      {/* Header with back button */}
      <div className="sticky top-0 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 px-6 py-5 flex items-center gap-4 z-10 w-full pt-8">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 transition-colors rounded-full text-white font-bold text-lg">
          ←
        </button>
        <h2 className="text-white text-xl font-black flex-1">Order History</h2>
      </div>

      <div className="p-5">
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl mb-5 text-sm">{error}</div>}

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-neutral-400 text-lg">
              {user?.role === "deliveryman"
                ? "Aapke pass koi delivery order nahi hai"
                : "You don't have any orders yet"}
            </p>
            <p className="text-neutral-500 text-sm mt-2">
              {user?.role === "deliveryman"
                ? "Jab aap orders accept karenge, yaha dikhenge"
                : "Khana order karke yaha dekhein"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order._id} className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
                {/* Order Header */}
                <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-bold">Order #{order._id?.slice(-6).toUpperCase()}</span>
                    </div>
                    <p className="text-neutral-400 text-xs">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${getStatusColor(order.status)}`}>
                    {getStatusEmoji(order.status)} {order.status || "Pending"}
                  </span>
                </div>

                {/* Restaurant Info */}
                <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-800/30">
                  <p className="text-neutral-400 text-xs uppercase tracking-wider mb-1">Restaurant</p>
                  <p className="text-white font-semibold">{order.restaurant?.name || "Unknown Restaurant"}</p>
                </div>

                {/* Order Items */}
                <div className="px-4 py-3 border-b border-neutral-800">
                  <p className="text-neutral-400 text-xs uppercase tracking-wider mb-3">Items</p>
                  <div className="space-y-2">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex-1">
                            <p className="text-white font-medium">{item.name}</p>
                            <p className="text-neutral-400 text-xs">Qty: {item.qty}</p>
                          </div>
                          <p className="text-orange-400 font-semibold">₹{item.price * item.qty}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-neutral-500 text-xs">No items found</p>
                    )}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="px-4 py-3 bg-neutral-800/30 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-neutral-400">Subtotal</p>
                    <p className="text-white">₹{order.subtotal}</p>
                  </div>
                  {order.deliveryFee && (
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-neutral-400">Delivery Fee</p>
                      <p className="text-white">₹{order.deliveryFee}</p>
                    </div>
                  )}
                  {order.discount && (
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-neutral-400">Discount</p>
                      <p className="text-green-400">-₹{order.discount}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-neutral-700">
                    <p className="text-white">Total</p>
                    <p className="text-orange-400">₹{order.total}</p>
                  </div>
                </div>

                {/* Delivery Address */}
                {order.deliveryAddress && (
                  <div className="px-4 py-3 border-t border-neutral-800">
                    <p className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Delivery Address</p>
                    <p className="text-white text-sm">
                      {typeof order.deliveryAddress === 'string' 
                        ? order.deliveryAddress 
                        : `${order.deliveryAddress.line1}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.pincode}`}
                    </p>
                  </div>
                )}

                {/* Deliveryman Info */}
                {order.deliveryman && (
                  <div className="px-4 py-3 border-t border-neutral-800">
                    <p className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Delivery Partner</p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
                        {order.deliveryman.name?.charAt(0).toUpperCase() || "D"}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{order.deliveryman.name || "Delivery Partner"}</p>
                        <p className="text-neutral-400 text-xs">{order.deliveryman.phone || "Contact info not available"}</p>
                      </div>
                      {order.status === "on_the_way" && (
                        <button className="text-orange-400 text-xs font-semibold">
                          Track Live 📍
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* ── Cancel Order button (customers only, cancellable statuses) ── */}
                {user?.role === "customer" && CANCELLABLE.includes(order.status) && (
                  <div className="px-4 pb-4 pt-2">
                    {confirmCancelId === order._id ? (
                      /* Confirmation row */
                      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3">
                        <p className="text-red-400 text-sm font-semibold text-center mb-3">
                          Are you sure you want to cancel this order?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => cancelOrder(order._id)}
                            disabled={cancellingId === order._id}
                            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                          >
                            {cancellingId === order._id ? (
                              <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Cancelling...</>
                            ) : "Yes, Cancel"}
                          </button>
                          <button
                            onClick={() => setConfirmCancelId(null)}
                            className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-sm transition-colors"
                          >
                            Keep Order
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmCancelId(order._id)}
                        className="w-full py-2.5 rounded-2xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-sm transition-colors"
                      >
                        ✕ Cancel Order
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
