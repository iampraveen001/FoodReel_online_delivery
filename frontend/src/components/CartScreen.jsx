import { useState, useEffect } from "react";
import { useCart } from "../hooks/useCart";

export default function CartScreen({ onProceedToPayment, user, token }) {
  const { cart, increment, decrement, subtotal } = useCart();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const deliveryCharge = 29;
  const total = subtotal + deliveryCharge;

  useEffect(() => {
    if (user?.role === "deliveryman") {
      fetchDeliveries();
    }
  }, [user]);

  const fetchDeliveries = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/deliveryman/mine`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setDeliveries(data.data.orders || []);
      } else {
        setError(data.message || "Failed to load deliveries");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to accept order");
      fetchDeliveries();
    } catch (err) {
      console.error(err);
      setError(err.message || "Accept failed");
    }
  };

  const handleMarkDelivered = async (orderId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/deliver`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to mark delivered");
      fetchDeliveries();
    } catch (err) {
      console.error(err);
      setError(err.message || "Delivery update failed");
    }
  };

  const renderDeliveryOrder = (order) => {
    const canAccept = order.status === "ready";
    const canDeliver = ["picked_up", "on_the_way"].includes(order.status);

    return (
      <div key={order._id} className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Order #{order.orderNumber || order._id?.slice(-6).toUpperCase()}</p>
            <p className="text-neutral-400 text-xs mt-1">{order.restaurant?.name || "Unknown Rest."}</p>
          </div>
          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
            {order.status?.replace(/_/g, " ")}
          </span>
        </div>

        <div className="px-4 py-3 border-b border-neutral-800">
          <p className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Delivery To</p>
          <p className="text-white text-sm">
            {typeof order.deliveryAddress === "string"
              ? order.deliveryAddress
              : `${order.deliveryAddress.line1}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.pincode}`}
          </p>
        </div>

        {order.customerLocation?.lat && order.customerLocation?.lng && (
          <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
            <p className="text-neutral-400 text-xs uppercase tracking-wider mb-2">Customer Live Location</p>
            <p className="text-white text-sm">
              {order.customerLocation.lat.toFixed(5)}, {order.customerLocation.lng.toFixed(5)}
            </p>
          </div>
        )}

        <div className="px-4 py-3 border-b border-neutral-800">
          <p className="text-neutral-400 text-xs uppercase tracking-wider mb-3">Items</p>
          <div className="space-y-2">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-white truncate">{item.name}</p>
                  <p className="text-neutral-500 text-xs">Qty: {item.qty}</p>
                </div>
                <p className="text-orange-400 font-semibold">₹{item.price * item.qty}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 space-y-2 bg-neutral-800/30">
          <div className="flex items-center justify-between text-sm text-neutral-400">
            <span>Subtotal</span>
            <span>₹{order.subtotal}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-neutral-400">
            <span>Delivery Fee</span>
            <span>₹{order.deliveryFee || deliveryCharge}</span>
          </div>
          <div className="border-t border-neutral-700 pt-2 flex items-center justify-between text-base font-bold">
            <span>Total</span>
            <span className="text-orange-400">₹{order.total}</span>
          </div>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          {canAccept && (
            <button
              onClick={() => handleAcceptOrder(order._id)}
              className="w-full bg-orange-500 hover:bg-orange-400 text-white py-3 rounded-2xl font-bold"
            >
              🚚 Pickup order
            </button>
          )}
          {canDeliver && (
            <button
              onClick={() => handleMarkDelivered(order._id)}
              className="w-full bg-green-500 hover:bg-green-400 text-white py-3 rounded-2xl font-bold"
            >
              ✅ Mark Delivered
            </button>
          )}
          {!canAccept && !canDeliver && (
            <div className="text-neutral-400 text-sm">Waiting for kitchen updates. Order will appear here once ready.</div>
          )}
        </div>
      </div>
    );
  };

  if (user?.role === "deliveryman") {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center text-orange-500 font-medium bg-neutral-950 absolute inset-0 rounded-[2.5rem]">
          Loading deliveries...
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto pb-16 bg-neutral-950 absolute inset-0 z-50 rounded-[2.5rem]">
        <div className="px-4 py-4 border-b border-neutral-800 bg-neutral-900">
          <h1 className="text-white text-xl font-black">Delivery Cart</h1>
          <p className="text-neutral-400 text-sm mt-1"> Orders for you</p>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {deliveries.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-white text-lg font-semibold">Cart is empty</p>
              <p className="text-neutral-500 text-sm">When getting orders, they will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deliveries.map(renderDeliveryOrder)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 pb-20">
        <span className="text-6xl">🛒</span>
        <p className="text-white text-lg font-semibold">Cart is empty!</p>
        <p className="text-neutral-500 text-sm"> add items to your cart</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden pb-16">
      {/* Header */}
      <div className="px-4 py-4 border-b border-neutral-800">
        <h1 className="text-white text-xl font-black">My Cart 🛒</h1>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {cart.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 bg-neutral-900 rounded-2xl p-3"
          >
            <div className="w-14 h-14 bg-neutral-800 rounded-xl flex items-center justify-center text-3xl shrink-0">
              {item.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{item.name}</p>
              <p className="text-neutral-500 text-xs">{item.restaurant}</p>
              <p className="text-orange-400 text-sm font-bold mt-0.5">₹{item.price}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => decrement(item.id)}
                className="w-7 h-7 rounded-full border border-neutral-700 bg-neutral-800 text-white flex items-center justify-center text-base leading-none hover:bg-neutral-700"
              >
                −
              </button>
              <span className="text-white font-medium text-sm w-5 text-center">{item.qty}</span>
              <button
                onClick={() => increment(item.id)}
                className="w-7 h-7 rounded-full border border-neutral-700 bg-neutral-800 text-white flex items-center justify-center text-base leading-none hover:bg-neutral-700"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bill Summary */}
      <div className="px-4 pb-2">
        <div className="bg-neutral-900 rounded-2xl p-4 mb-3">
          <div className="flex justify-between text-sm text-neutral-400 mb-2">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>
          <div className="flex justify-between text-sm text-neutral-400 mb-3">
            <span>Delivery charge</span>
            <span>₹{deliveryCharge}</span>
          </div>
          <div className="border-t border-neutral-800 pt-3 flex justify-between">
            <span className="text-white font-black text-lg">Total</span>
            <span className="text-orange-400 font-black text-lg">₹{total}</span>
          </div>
        </div>

        {(!user || user.role === "customer") ? (
          <button
            onClick={() => onProceedToPayment(total)}
            className="w-full bg-orange-500 hover:bg-orange-400 active:scale-[0.98] text-white py-4 rounded-2xl font-black text-base transition-all"
          >
            🛵Place Order — ₹{total}
          </button>
        ) : (
          <button
            disabled
            className="w-full bg-neutral-800 border-2 border-neutral-700/50 text-neutral-500 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider cursor-not-allowed"
          >
            🔒 Staff Cannot Order
          </button>
        )}
      </div>
    </div>
  );
}
