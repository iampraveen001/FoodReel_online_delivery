import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const STATUS_COLORS = {
  pending:   { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" },
  confirmed: { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/30"   },
  preparing: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  ready:     { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/30"  },
  cancelled: { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/30"    },
  delivered: { bg: "bg-neutral-500/10",text: "text-neutral-400",border: "border-neutral-500/30"},
};

export default function OwnerScreen({ user, token, onBack }) {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videos, setVideos] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("orders"); // "orders" | "menu" | "upload"
  const [newOrderPing, setNewOrderPing] = useState(false);
  const [newOrderBanner, setNewOrderBanner] = useState(null);

  // Forms states
  const [restaurantName, setRestaurantName] = useState("");

  // Upload states
  const [foodName, setFoodName] = useState("");
  const [foodPrice, setFoodPrice] = useState("");
  const [foodDesc, setFoodDesc] = useState("");
  const [foodIsVeg, setFoodIsVeg] = useState(true);
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  // Menu item management
  const [menuItems, setMenuItems] = useState([]);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingPrice, setEditingPrice] = useState({}); // { [id]: newPrice }

  const socketRef = useRef(null);

  useEffect(() => {
    fetchMyRestaurant();
  }, []);

  // Connect socket once restaurant is loaded
  useEffect(() => {
    if (!restaurant?._id || !token) return;

    const socket = io(`${import.meta.env.VITE_API_URL}`, { auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Owner socket connected, joining restaurant room:", restaurant._id);
      socket.emit("join_restaurant", restaurant._id);
    });

    // If already connected when the effect runs
    if (socket.connected) {
      socket.emit("join_restaurant", restaurant._id);
    }

    socket.on("new_order", (order) => {
      // Prepend to orders list with populated data
      setOrders((prev) => [order, ...prev.filter((o) => o._id !== order._id)]);
      setNewOrderPing(true);
      setTimeout(() => setNewOrderPing(false), 4000);

      // Show inline banner
      const banner = {
        id: order._id,
        customer: order.customer?.name || "A customer",
        total: order.total,
        orderNumber: order.orderNumber || order._id?.slice(-6).toUpperCase(),
      };
      setNewOrderBanner(banner);
      setTimeout(() => setNewOrderBanner(null), 6000);

      // Play audio beep using Web Audio API (no external file needed)
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      } catch (_) { /* audio not supported */ }

      // Browser notification (if permission granted)
      if (Notification.permission === "granted") {
        new Notification("🔔 New Order!", {
          body: `${banner.customer} ordered ₹${banner.total} — #${banner.orderNumber}`,
          icon: "/favicon.ico",
        });
      } else if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    });

    // Real-time status updates (from deliveryman or system)
    socket.on("order_update", ({ orderId, status }) => {
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, status } : o))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [restaurant?._id, token]);

  const fetchMyRestaurant = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/restaurants/owner/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRestaurant(data.data.restaurant);
        if (data.data.restaurant) {
          fetchVideos(data.data.restaurant._id);
          fetchOrders(data.data.restaurant._id);
        }
      } else {
        setError("Failed to load restaurant data");
      }
    } catch (err) {
      setError("Failed to load restaurant data");
    } finally {
      setLoading(false);
    }
  };

  const fetchVideos = async (restaurantId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/food/restaurant/${restaurantId}`);
      const data = await res.json();
      if (res.ok) {
        setVideos(data.data.foodItems || data.data.items || []);
        setMenuItems(data.data.foodItems || data.data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch videos:", err);
    }
  };

  const fetchOrders = async (restaurantId) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/orders/restaurant/${restaurantId}?limit=30`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok) setOrders(data.data.orders || []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, status } : o))
        );
      } else {
        setError(data.message || "Failed to update order");
      }
    } catch (err) {
      setError("Network error");
    }
  };

  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    if (!restaurantName.trim()) { setError("Please enter a restaurant name"); return; }
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/restaurants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: restaurantName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 409 ? "You already have a restaurant." : (data.message || "Failed to create restaurant"));
        return;
      }
      setRestaurant(data.data.restaurant);
      setRestaurantName("");
    } catch (err) {
      setError(err.message || "Failed to create restaurant");
    }
  };

  const handleToggleStatus = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/restaurants/${restaurant._id}/toggle`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setRestaurant({ ...restaurant, isOpen: data.data.isOpen });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadVideo = async (e) => {
    e.preventDefault();
    if (!videoFile || !foodName || !foodPrice) return;
    setUploading(true);
    setMessage(null);
    setError(null);
    const formData = new FormData();
    formData.append("restaurant", restaurant._id);
    formData.append("name", foodName);
    formData.append("price", foodPrice);
    formData.append("description", foodDesc);
    formData.append("isVeg", foodIsVeg);
    formData.append("video", videoFile);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/food`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage("🎉 Reel uploaded successfully!");
      setVideoFile(null);
      setFoodName("");
      setFoodPrice("");
      setFoodDesc("");
      document.querySelector('input[type="file"]').value = "";
      fetchVideos(restaurant._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Menu item handlers ─────────────────────────────────────
  const handleAddItem = async (e) => {
    e.preventDefault();
    setUploading(true);
    setMessage(null);
    setError(null);
    const formData = new FormData();
    formData.append("restaurant", restaurant._id);
    formData.append("name", foodName);
    formData.append("price", foodPrice);
    formData.append("description", foodDesc);
    formData.append("isVeg", foodIsVeg);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/food`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage("✅ Item added to menu!");
      setMenuItems((prev) => [data.data.item, ...prev]);
      setFoodName("");
      setFoodPrice("");
      setFoodDesc("");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleAvailability = async (itemId) => {
    setTogglingId(itemId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/food/${itemId}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMenuItems((prev) =>
          prev.map((item) =>
            item._id === itemId ? { ...item, isAvailable: data.data.isAvailable } : item
          )
        );
      }
    } catch (err) {
      console.error("Toggle error:", err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Remove this item from the menu?")) return;
    setDeletingId(itemId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/food/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMenuItems((prev) => prev.filter((item) => item._id !== itemId));
        setMessage("🗑️ Item removed from menu.");
      }
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSavePrice = async (itemId) => {
    const newPrice = parseFloat(editingPrice[itemId]);
    if (!newPrice || newPrice <= 0) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/food/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: newPrice }),
      });
      const data = await res.json();
      if (res.ok) {
        setMenuItems((prev) =>
          prev.map((item) => (item._id === itemId ? { ...item, price: newPrice } : item))
        );
        setEditingPrice((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
        setMessage("💰 Price updated!");
      }
    } catch (err) {
      console.error("Price update error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-orange-500 font-medium z-50 bg-neutral-950 absolute inset-0 rounded-[2.5rem]">
        Loading Portal...
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => ["pending", "confirmed", "preparing", "ready"].includes(o.status));
  const pastOrders = orders.filter((o) => ["delivered", "cancelled"].includes(o.status));

  return (
    <div className="flex-1 overflow-y-auto pb-6 bg-neutral-950 absolute inset-0 z-50 rounded-[2.5rem]">
      {/* Header */}
      <div className="sticky top-0 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 px-6 py-5 flex items-center gap-4 z-10 w-full pt-8">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 transition-colors rounded-full text-white font-bold text-lg">
          ←
        </button>
        <h2 className="text-white text-xl font-black flex-1">Owner Portal</h2>
        {newOrderPing && (
          <span className="text-xs font-bold text-white bg-orange-500 px-3 py-1 rounded-full animate-pulse">
            🔔 New Order!
          </span>
        )}
      </div>

      <div className="p-5">
        {/* ── New Order Banner ── slides in when a new order arrives via socket */}
        {newOrderBanner && (
          <div className="mb-4 flex items-center gap-3 bg-orange-500 rounded-2xl px-4 py-3 shadow-xl shadow-orange-500/30 animate-pulse">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl flex-shrink-0">
              🔔
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm leading-tight">New Order #{newOrderBanner.orderNumber}</p>
              <p className="text-orange-100 text-xs mt-0.5 truncate">
                {newOrderBanner.customer} · ₹{newOrderBanner.total}
              </p>
            </div>
            <button
              onClick={() => setNewOrderBanner(null)}
              className="text-white/70 hover:text-white text-lg leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>
        )}

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl mb-5 text-sm">{error}</div>}
        {message && <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-xl mb-5 text-sm">{message}</div>}

        {!restaurant ? (
          /* ── Setup restaurant form ── */
          <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 mt-4 shadow-xl">
            <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">🍽️</div>
            <h3 className="text-2xl text-white font-black text-center mb-2">Setup Restaurant</h3>
            <p className="text-neutral-400 text-sm text-center mb-8">Create your digital kitchen profile to start taking orders and posting reels.</p>
            <form onSubmit={handleCreateRestaurant} className="space-y-5">
              <div>
                <label className="text-neutral-400 text-xs font-bold mb-2 block uppercase tracking-wider ml-1">Restaurant Name</label>
                <input
                  type="text" value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="w-full bg-black border border-neutral-800 focus:border-orange-500 rounded-2xl px-4 py-4 text-white outline-none transition-all"
                  placeholder="E.g. Sharma Dhaba" required
                />
              </div>
              <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20">
                Register Restaurant
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6 pb-20">
            {/* Restaurant Info Card */}
            <div className="bg-gradient-to-br from-neutral-900 to-black p-6 rounded-3xl border border-neutral-800 shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl text-white font-black leading-tight">{restaurant.name}</h3>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {restaurant.isApproved ? (
                      <span className="text-green-400 text-xs font-bold bg-green-500/10 px-2 py-1 rounded-md">✅ Verified</span>
                    ) : (
                      <span className="text-yellow-500 text-xs font-bold bg-yellow-500/10 px-2 py-1 rounded-md">⏳ Pending Approval</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleToggleStatus}
                  className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-md ${restaurant.isOpen ? "bg-green-500 text-white shadow-green-500/20" : "bg-red-500 text-white shadow-red-500/20"}`}
                >
                  {restaurant.isOpen ? "🟢 OPEN" : "🔴 CLOSED"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800/50 flex flex-col items-center">
                  <div className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">Orders</div>
                  <div className="text-orange-400 font-black text-2xl">{restaurant.totalOrders || 0}</div>
                </div>
                <div className="bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800/50 flex flex-col items-center">
                  <div className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">Rating</div>
                  <div className="text-white font-black text-2xl flex items-center gap-1">
                    <span className="text-yellow-500 text-lg">★</span> {restaurant.avgRating || "0.0"}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1.5 bg-neutral-900 p-1.5 rounded-2xl border border-neutral-800">
              <button
                onClick={() => setActiveTab("orders")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "orders" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-neutral-400 hover:text-white"}`}
              >
                📋 Orders
                {pendingOrders.length > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === "orders" ? "bg-white text-orange-500" : "bg-orange-500 text-white"}`}>
                    {pendingOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("menu")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "menu" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-neutral-400 hover:text-white"}`}
              >
                🍽️ Menu
                {menuItems.length > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === "menu" ? "bg-white text-orange-500" : "bg-neutral-700 text-neutral-300"}`}>
                    {menuItems.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("upload")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "upload" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-neutral-400 hover:text-white"}`}
              >
                📹 Upload
              </button>
            </div>

            {/* ── ORDERS TAB ── */}
            {activeTab === "orders" && (
              <div className="space-y-4">
                {/* Active Orders */}
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  🔥 Active Orders
                  {pendingOrders.length > 0 && (
                    <span className="text-xs bg-orange-500 text-white font-bold px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
                  )}
                </h3>

                {pendingOrders.length === 0 ? (
                  <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-8 text-center">
                    <div className="text-4xl mb-3">📭</div>
                    <p className="text-neutral-400 font-semibold">No active orders right now</p>
                    <p className="text-neutral-600 text-xs mt-1">New orders will appear here instantly</p>
                  </div>
                ) : (
                  pendingOrders.map((order) => (
                    <OrderCard key={order._id} order={order} onUpdateStatus={handleUpdateOrderStatus} />
                  ))
                )}

                {/* Past Orders */}
                {pastOrders.length > 0 && (
                  <>
                    <h3 className="text-neutral-500 font-black text-sm uppercase tracking-wider mt-4">Past Orders</h3>
                    {pastOrders.slice(0, 5).map((order) => (
                      <OrderCard key={order._id} order={order} onUpdateStatus={handleUpdateOrderStatus} past />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── MENU TAB ── */}
            {activeTab === "menu" && (
              <div className="space-y-4">
                {/* Add Item Quick Form */}
                <div className="bg-neutral-900 p-5 rounded-3xl border border-neutral-800 shadow-xl">
                  <h3 className="text-white font-black text-base mb-4 flex items-center gap-2">
                    <span className="text-orange-500">➕</span> Add Menu Item
                  </h3>
                  <form onSubmit={handleAddItem} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-neutral-500 text-xs font-bold mb-1 block uppercase tracking-wider ml-1">Item Name</label>
                        <input
                          type="text" value={foodName} onChange={(e) => setFoodName(e.target.value)}
                          className="w-full bg-black border border-neutral-800 focus:border-orange-500 rounded-xl px-3 py-3 text-white text-sm outline-none transition-all"
                          placeholder="Butter Chicken" required
                        />
                      </div>
                      <div>
                        <label className="text-neutral-500 text-xs font-bold mb-1 block uppercase tracking-wider ml-1">Price (₹)</label>
                        <input
                          type="number" value={foodPrice} onChange={(e) => setFoodPrice(e.target.value)}
                          className="w-full bg-black border border-neutral-800 focus:border-orange-500 rounded-xl px-3 py-3 text-white text-sm outline-none transition-all"
                          placeholder="250" required min="1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-neutral-500 text-xs font-bold mb-1 block uppercase tracking-wider ml-1">Description (optional)</label>
                      <input
                        type="text" value={foodDesc} onChange={(e) => setFoodDesc(e.target.value)}
                        className="w-full bg-black border border-neutral-800 focus:border-orange-500 rounded-xl px-3 py-3 text-white text-sm outline-none transition-all"
                        placeholder="Rich creamy curry with tender chicken..."
                      />
                    </div>
                    {/* Veg / Non-Veg toggle */}
                    <button
                      type="button"
                      onClick={() => setFoodIsVeg((v) => !v)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        foodIsVeg
                          ? "bg-green-500/10 border-green-500/40 text-green-400"
                          : "bg-red-500/10 border-red-500/40 text-red-400"
                      }`}
                    >
                      <span className="w-4 h-4 rounded-sm border-2 flex items-center justify-center text-xs" style={{ borderColor: "currentColor" }}>
                        {foodIsVeg ? "🟢" : "🔴"}
                      </span>
                      {foodIsVeg ? "Veg" : "Non-Veg"}
                    </button>
                    <button
                      type="submit" disabled={uploading}
                      className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Adding...</>
                      ) : "➕ Add to Menu"}
                    </button>
                  </form>
                </div>

                {/* Menu Items List */}
                {menuItems.length === 0 ? (
                  <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-8 text-center">
                    <div className="text-4xl mb-3">🍽️</div>
                    <p className="text-neutral-400 font-semibold">No menu items yet</p>
                    <p className="text-neutral-600 text-xs mt-1">Add your first item above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-neutral-500 text-xs uppercase tracking-wider font-bold">
                      All Items ({menuItems.length})
                    </p>
                    {menuItems.map((item) => (
                      <div
                        key={item._id}
                        className={`rounded-2xl border overflow-hidden transition-all ${
                          item.isAvailable
                            ? "bg-neutral-900 border-neutral-800"
                            : "bg-neutral-900/40 border-neutral-800/50 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          {/* Thumbnail or icon */}
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0 flex items-center justify-center">
                            {item.thumbnailUrl ? (
                              <img
                                src={`${import.meta.env.VITE_API_URL}/${item.thumbnailUrl.replace(/^\/+/, "")}`}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-2xl">{item.isVeg ? "🥗" : "🍖"}</span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="text-white text-sm font-bold truncate">{item.name}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${item.isVeg ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                {item.isVeg ? "VEG" : "NON-VEG"}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-neutral-500 text-xs truncate mb-1">{item.description}</p>
                            )}
                            {/* Inline price editor */}
                            <div className="flex items-center gap-2">
                              {editingPrice[item._id] !== undefined ? (
                                <>
                                  <input
                                    type="number"
                                    value={editingPrice[item._id]}
                                    onChange={(e) => setEditingPrice((p) => ({ ...p, [item._id]: e.target.value }))}
                                    className="w-20 bg-black border border-orange-500 rounded-lg px-2 py-1 text-white text-xs outline-none"
                                    min="1"
                                  />
                                  <button onClick={() => handleSavePrice(item._id)} className="text-green-400 text-xs font-bold hover:text-green-300">Save</button>
                                  <button onClick={() => setEditingPrice((p) => { const n = { ...p }; delete n[item._id]; return n; })} className="text-neutral-500 text-xs">✕</button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setEditingPrice((p) => ({ ...p, [item._id]: item.price }))}
                                  className="text-orange-400 font-black text-sm hover:text-orange-300 transition-colors"
                                >
                                  ₹{item.price}
                                  <span className="text-neutral-600 text-[10px] ml-1 font-normal">edit</span>
                                </button>
                              )}
                              <span className="text-neutral-600 text-xs">·</span>
                              <span className="text-neutral-500 text-xs">❤️ {item.likes || 0}</span>
                              <span className="text-neutral-500 text-xs">👁️ {item.views || 0}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            {/* Availability toggle */}
                            <button
                              onClick={() => handleToggleAvailability(item._id)}
                              disabled={togglingId === item._id}
                              className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                                item.isAvailable ? "bg-green-500" : "bg-neutral-700"
                              } ${togglingId === item._id ? "opacity-50" : ""}`}
                            >
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${item.isAvailable ? "left-5" : "left-0.5"}`} />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteItem(item._id)}
                              disabled={deletingId === item._id}
                              className="w-7 h-7 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg flex items-center justify-center text-red-400 text-xs transition-all"
                            >
                              {deletingId === item._id ? "⏳" : "🗑️"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── UPLOAD TAB ── */}
            {activeTab === "upload" && (
              <div className="space-y-6">
                {/* Uploaded Videos */}
                {videos.length > 0 && (
                  <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-xl">
                    <h3 className="text-xl text-white font-black mb-6 flex items-center gap-2">
                      <span className="text-orange-500 text-2xl">🎬</span> Your Reels ({videos.length})
                    </h3>
                    <div className="space-y-4">
                      {videos.map((video) => (
                        <div key={video._id} className="bg-neutral-800/50 p-4 rounded-2xl border border-neutral-700/50 flex items-center gap-4">
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-700 flex-shrink-0">
                            {video.thumbnailUrl ? (
                              <img src={`${import.meta.env.VITE_API_URL}/${video.thumbnailUrl.replace(/^\/+/, "")}`} alt={video.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-400 text-lg">🎥</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-semibold text-sm truncate">{video.name}</h4>
                            <p className="text-orange-400 font-bold text-sm">₹{video.price}</p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-neutral-400 text-xs">❤️ {video.likes}</span>
                              <span className="text-neutral-400 text-xs">👁️ {video.views}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload Form */}
                <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-xl">
                  <h3 className="text-xl text-white font-black mb-6 flex items-center gap-2">
                    <span className="text-orange-500 text-2xl">📹</span> Upload Food Reel
                  </h3>
                  <form onSubmit={handleUploadVideo} className="space-y-5">
                    <div>
                      <label className="text-neutral-400 text-xs font-bold mb-2 block uppercase tracking-wider ml-1">Food Item Name</label>
                      <input type="text" value={foodName} onChange={(e) => setFoodName(e.target.value)}
                        className="w-full bg-black border border-neutral-800 focus:border-orange-500 rounded-2xl px-4 py-4 text-white outline-none transition-all"
                        placeholder="E.g. Butter Chicken" required />
                    </div>
                    <div>
                      <label className="text-neutral-400 text-xs font-bold mb-2 block uppercase tracking-wider ml-1">Price (₹)</label>
                      <input type="number" value={foodPrice} onChange={(e) => setFoodPrice(e.target.value)}
                        className="w-full bg-black border border-neutral-800 focus:border-orange-500 rounded-2xl px-4 py-4 text-white outline-none transition-all"
                        placeholder="250" required />
                    </div>
                    <div>
                      <label className="text-neutral-400 text-xs font-bold mb-2 block uppercase tracking-wider ml-1">Video File</label>
                      <div className="w-full bg-black border-2 border-dashed border-neutral-700 hover:border-orange-500 transition-colors rounded-2xl px-4 py-6 text-center cursor-pointer relative overflow-hidden group">
                        <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" required />
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-10 h-10 bg-neutral-800 group-hover:bg-orange-500/20 text-neutral-400 group-hover:text-orange-500 transition-colors rounded-full flex items-center justify-center text-lg">+</div>
                          <span className="text-sm font-semibold text-neutral-300 group-hover:text-white transition-colors">
                            {videoFile ? videoFile.name : "Tap to select a vertical video"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button type="submit" disabled={uploading}
                      className="w-full bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 disabled:opacity-50 disabled:bg-neutral-700 disabled:text-neutral-400 font-bold py-4 rounded-2xl transition-all shadow-xl mt-4 flex justify-center items-center gap-2 text-base">
                      {uploading ? <>⏳ Uploading Video...</> : <>📤 Post Reel</>}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Order Card Sub-Component ── */
function OrderCard({ order, onUpdateStatus, past = false }) {
  const c = STATUS_COLORS[order.status] || STATUS_COLORS.pending;

  const nextActions = {
    pending:   [{ label: "✅ Confirm",   status: "confirmed" }, { label: "❌ Cancel", status: "cancelled" }],
    confirmed: [{ label: "👨‍🍳 Preparing", status: "preparing" }],
    preparing: [{ label: "🍽️ Ready",     status: "ready" }],
    ready:     [],
  };
  const actions = nextActions[order.status] || [];

  return (
    <div className={`rounded-3xl border overflow-hidden ${c.border} bg-neutral-900`}>
      {/* Order Header */}
      <div className={`px-5 py-3 flex items-center justify-between ${c.bg}`}>
        <div>
          <p className={`font-black text-sm ${c.text}`}>
            #{order.orderNumber || order._id?.slice(-6).toUpperCase()}
          </p>
          <p className="text-neutral-500 text-xs mt-0.5">
            {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${c.bg} ${c.text} ${c.border} capitalize`}>
          {order.status?.replace(/_/g, " ")}
        </span>
      </div>

      {/* Customer */}
      <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/30 rounded-full flex items-center justify-center text-sm">👤</div>
        <div>
          <p className="text-white text-sm font-semibold">{order.customer?.name || "Customer"}</p>
          <p className="text-neutral-500 text-xs">{order.customer?.phone || ""}</p>
        </div>
      </div>

      {/* Items */}
      <div className="px-5 py-3 border-b border-neutral-800">
        <p className="text-neutral-500 text-xs uppercase tracking-wider mb-2">Items</p>
        <div className="space-y-1.5">
          {order.items?.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-white">{item.qty}× {item.name}</span>
              <span className="text-orange-400 font-semibold">₹{item.price * item.qty}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="px-5 py-3 flex items-center justify-between">
        <div>
          <span className="text-neutral-400 text-xs">{order.paymentMethod?.toUpperCase()} · </span>
          <span className={`text-xs font-bold ${order.paymentStatus === "paid" ? "text-green-400" : "text-yellow-400"}`}>
            {order.paymentStatus === "paid" ? "Paid" : "Pending"}
          </span>
        </div>
        <span className="text-white font-black text-base">₹{order.total}</span>
      </div>

      {/* Action Buttons */}
      {!past && actions.length > 0 && (
        <div className="px-5 pb-4 flex gap-2">
          {actions.map((action) => (
            <button
              key={action.status}
              onClick={() => onUpdateStatus(order._id, action.status)}
              className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                action.status === "cancelled"
                  ? "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                  : "bg-orange-500 text-white hover:bg-orange-400 shadow-md shadow-orange-500/20"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
