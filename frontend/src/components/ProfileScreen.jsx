import { useState, useEffect } from "react";
import OrdersScreen from "./OrdersScreen";

// Menu items shown directly on profile page
const MENU_ITEMS = [
  {
    icon: "📦",
    bg: "bg-orange-500/20",
    label: "Old Orders",
    action: "orders",
  },
  {
    icon: "❤️",
    bg: "bg-red-500/20",
    label: "Favourite Restaurants",
    action: "favorites",
  },
  {
    icon: "📍",
    bg: "bg-pink-500/20",
    label: "Saved Addresses",
    action: "addresses",
  },
  {
    icon: "💳",
    bg: "bg-blue-500/20",
    label: "Payment Methods",
    action: "payment",
  },
  {
    icon: "⚙️",
    bg: "bg-neutral-700",
    label: "Settings",
    action: "settings",
  },
];

export default function ProfileScreen({ user, token, onProfileUpdate, onRestaurantClick, onLogout }) {
  const [restaurant, setRestaurant]             = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [currentView, setCurrentView]           = useState("profile");
  const [avatarPreview, setAvatarPreview]       = useState(null);
  const [uploadingAvatar, setUploadingAvatar]   = useState(false);
  const [avatarMessage, setAvatarMessage]       = useState(null);
  const [savedAddresses, setSavedAddresses]     = useState([
    { id: "home", label: "Home Address", address: "123, Jagatganj Road, Prayagraj, Uttar Pradesh, 211003" },
    { id: "work", label: "Work Address", address: "ABCD Tower, Civil Lines, Prayagraj" },
  ]);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [editFormData, setEditFormData]         = useState({ label: "", address: "" });

  const userName  = user?.name  || "Rahul Sharma";
  const userEmail = user?.email || "rahul@example.com";
  const userCity  = "Prayagraj";

  const userImageUrl = (avatar) => {
    if (!avatar) return null;
    return avatar.startsWith("http")
      ? avatar
      : `http://localhost:5000/${avatar.replace(/^\/+/, "")}`;
  };

  useEffect(() => {
    setAvatarPreview(user?.avatar ? userImageUrl(user.avatar) : null);
  }, [user]);

  useEffect(() => {
    if (user?.role === "owner") fetchRestaurantStatus();
  }, [user, token]);

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setAvatarMessage("Please select a valid image file."); return; }
    if (file.size > 5 * 1024 * 1024)    { setAvatarMessage("Image must be smaller than 5MB.");   return; }

    setUploadingAvatar(true);
    setAvatarMessage(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res  = await fetch("http://localhost:5000/api/users/profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update profile image.");
      setAvatarPreview(userImageUrl(data.data.user.avatar));
      onProfileUpdate?.(data.data.user);
      setAvatarMessage("Profile picture updated!");
    } catch (err) {
      setAvatarMessage(err.message || "Upload failed.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  // ── Restaurant status ─────────────────────────────────────────────────────
  const fetchRestaurantStatus = async () => {
    try {
      setLoadingRestaurant(true);
      const res  = await fetch("http://localhost:5000/api/restaurants/owner/mine", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.data?.restaurant) setRestaurant(data.data.restaurant);
    } catch (err) {
      console.error("Failed to fetch restaurant status:", err);
    } finally {
      setLoadingRestaurant(false);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleMenuClick = (action) => {
    if (action === "restaurant") { onRestaurantClick(); return; }
    if (action === "logout")     { onLogout();           return; }
    setCurrentView(action);
  };

  // ── Sub-screen header ─────────────────────────────────────────────────────
  const SubHeader = ({ title }) => (
    <div className="sticky top-0 z-50 px-4 pt-6 pb-4 bg-neutral-950/95 backdrop-blur-sm border-b border-neutral-800 flex items-center gap-4">
      <button
        onClick={() => setCurrentView("profile")}
        className="w-9 h-9 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 rounded-full text-white font-bold text-lg transition-colors"
      >
        ←
      </button>
      <h2 className="text-white text-xl font-black flex-1">{title}</h2>
      <div className="w-9" />
    </div>
  );

  // ── Sub-screen content ────────────────────────────────────────────────────
  const renderSubScreen = () => {
    switch (currentView) {
      case "orders":
        return <OrdersScreen user={user} token={token} onBack={() => setCurrentView("profile")} />;

      case "favorites":
        return (
          <div className="absolute inset-0 z-50 bg-neutral-950 overflow-y-auto pb-6">
            <SubHeader title="Pasandida Restaurants" />
            <div className="p-5">
              <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 text-center">
                <p className="text-neutral-400 mb-3">Yaha aapki pasandida restaurants ka list dikhega.</p>
                <p className="text-white text-sm">Feature abhi development mein hai.</p>
              </div>
            </div>
          </div>
        );

      case "addresses":
        return (
          <div className="absolute inset-0 z-50 bg-neutral-950 overflow-y-auto pb-6">
            <SubHeader title="Saved Addresses" />
            <div className="p-5 space-y-4">
              {editingAddressId ? (
                <div className="bg-neutral-900 rounded-3xl border border-orange-500/30 p-5 space-y-3">
                  <div>
                    <label className="block text-neutral-400 text-xs font-semibold mb-1 uppercase tracking-wider">Address Label</label>
                    <input
                      type="text"
                      value={editFormData.label}
                      onChange={(e) => setEditFormData({ ...editFormData, label: e.target.value })}
                      className="w-full bg-neutral-800 border border-neutral-700 focus:border-orange-500 rounded-xl px-3 py-2.5 text-white outline-none transition-colors text-sm"
                      placeholder="e.g., Home, Work, Other"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 text-xs font-semibold mb-1 uppercase tracking-wider">Full Address</label>
                    <textarea
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      className="w-full bg-neutral-800 border border-neutral-700 focus:border-orange-500 rounded-xl px-3 py-2.5 text-white outline-none transition-colors text-sm resize-none h-24"
                      placeholder="Enter your complete address"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const updated = savedAddresses.map((a) =>
                          a.id === editingAddressId ? { ...a, label: editFormData.label, address: editFormData.address } : a
                        );
                        setSavedAddresses(updated);
                        setEditingAddressId(null);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                    >✓ Save</button>
                    <button
                      onClick={() => setEditingAddressId(null)}
                      className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                    >✕ Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  {savedAddresses.map((addr) => (
                    <div key={addr.id} className="bg-neutral-900 rounded-3xl border border-neutral-800 p-5 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-neutral-500 text-xs uppercase tracking-wider mb-2">{addr.label}</div>
                        <div className="text-white text-sm">{addr.address}</div>
                      </div>
                      <button
                        onClick={() => { setEditingAddressId(addr.id); setEditFormData({ label: addr.label, address: addr.address }); }}
                        className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                      >✎ Edit</button>
                    </div>
                  ))}
                  <button
                    onClick={() => { setEditingAddressId("new"); setEditFormData({ label: "", address: "" }); }}
                    className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold py-3 rounded-2xl transition-colors text-sm"
                  >+ Add New Address</button>
                </>
              )}
            </div>
          </div>
        );

      case "payment":
        return (
          <div className="absolute inset-0 z-50 bg-neutral-950 overflow-y-auto pb-6">
            <SubHeader title="Payment Methods" />
            <div className="p-5 space-y-4">
              <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-neutral-400 text-xs uppercase tracking-wider">Saved Card</div>
                    <div className="text-white text-sm">**** **** **** 4242</div>
                  </div>
                  <span className="text-green-400 text-xs font-bold">Active</span>
                </div>
                <div className="text-neutral-500 text-xs">Expiry 12/27</div>
              </div>
              <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-5">
                <div className="text-neutral-400 text-xs uppercase tracking-wider mb-2">UPI</div>
                <div className="text-white text-sm">rahul@okhdfcbank</div>
              </div>
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="absolute inset-0 z-50 bg-neutral-950 overflow-y-auto pb-6">
            <SubHeader title="Settings" />
            <div className="p-5 space-y-3">
              {[
                { label: "Account Details", value: userEmail },
                { label: "Language",        value: "Hindi" },
                { label: "Notifications",   value: "Enabled" },
              ].map((item) => (
                <div key={item.label} className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-neutral-400 text-xs uppercase tracking-wider">{item.label}</div>
                    <div className="text-white text-sm">{item.value}</div>
                  </div>
                  <span className="text-neutral-500 text-sm">›</span>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Main profile view ─────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto pb-20 bg-black relative">
      {/* Sub-screens slide over */}
      {currentView !== "profile" && renderSubScreen()}

      {/* ── Avatar + Name ──────────────────────────────────────────── */}
      <div className="flex flex-col items-center pt-10 pb-6 px-6">
        {/* Avatar */}
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-5xl shadow-xl shadow-orange-500/30">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              "😊"
            )}
          </div>
          {/* Edit badge */}
          <label
            htmlFor="avatar-upload"
            className="absolute bottom-0 right-0 w-7 h-7 bg-neutral-800 border-2 border-black rounded-full flex items-center justify-center text-xs cursor-pointer hover:bg-neutral-700 transition-colors"
          >
            ✎
          </label>
        </div>
        <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

        {/* Name */}
        <h1 className="text-white text-2xl font-black tracking-tight mb-1">{userName}</h1>

        {/* Email · City */}
        <p className="text-neutral-500 text-sm">
          {userEmail}
          {userCity && <span> · {userCity}</span>}
        </p>

        {/* Avatar message */}
        {avatarMessage && (
          <p className={`mt-2 text-xs font-medium ${uploadingAvatar ? "text-neutral-400" : "text-green-400"}`}>
            {avatarMessage}
          </p>
        )}
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────── */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "47",   sub: "Orders",  color: "text-orange-400" },
            { value: "₹12k", sub: "Kharca",  color: "text-orange-400" },
            { value: "8",    sub: "Saved",   color: "text-orange-400" },
          ].map((s) => (
            <div
              key={s.sub}
              className="bg-neutral-900 rounded-2xl py-4 px-3 text-center border border-neutral-800"
            >
              <div className={`${s.color} text-2xl font-black leading-none`}>{s.value}</div>
              <div className="text-neutral-500 text-xs mt-1.5 font-medium">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>



      {/* ── Menu List ──────────────────────────────────────────────── */}
      <div className="px-4">
        <div className="bg-neutral-950 rounded-3xl overflow-hidden border border-neutral-900">
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item.action}
              onClick={() => handleMenuClick(item.action)}
              className="w-full flex items-center gap-4 px-5 py-4 active:bg-neutral-900 transition-colors border-b border-neutral-900"
            >
              <div className={`w-11 h-11 rounded-2xl ${item.bg} flex items-center justify-center text-xl flex-shrink-0`}>
                {item.icon}
              </div>
              <span className="flex-1 text-left text-white text-[15px] font-medium">{item.label}</span>
              <span className="text-neutral-600 text-lg">›</span>
            </button>
          ))}

          {/* ── Owner: My Restaurant row (inside same card) ── */}
          {user?.role === "owner" && (
            <button
              onClick={() => handleMenuClick("restaurant")}
              className="w-full flex items-center gap-4 px-5 py-4 active:bg-neutral-900 transition-colors border-b border-neutral-900"
            >
              <div className="w-11 h-11 rounded-2xl bg-orange-500/20 flex items-center justify-center text-xl flex-shrink-0">🍽️</div>
              <div className="flex-1 text-left">
                <span className="text-white text-[15px] font-medium block">My Restaurant</span>
                {loadingRestaurant ? (
                  <span className="text-neutral-600 text-xs">Loading...</span>
                ) : restaurant ? (
                  <span className={`text-xs font-semibold ${
                    restaurant.isOpen ? "text-green-400" : "text-red-400"
                  }`}>
                    {restaurant.name} · {restaurant.isOpen ? "🟢 Open" : "🔴 Closed"}
                  </span>
                ) : (
                  <span className="text-neutral-500 text-xs">Set up your restaurant</span>
                )}
              </div>
              <span className="text-orange-500 text-lg">›</span>
            </button>
          )}

          {/* Settings is last — no border-b, handled above; just make last item borderless */}
        </div>

        {/* ── Logout row ───────────────────────────────────────────── */}
        <button
          onClick={() => handleMenuClick("logout")}
          className="mt-3 w-full flex items-center gap-4 px-5 py-4 bg-neutral-950 rounded-3xl border border-neutral-900 active:bg-red-500/5 transition-colors"
        >
          <div className="w-11 h-11 rounded-2xl bg-red-500/15 flex items-center justify-center text-xl flex-shrink-0">🚪</div>
          <span className="flex-1 text-left text-red-500 text-[15px] font-medium">Log out</span>
          <span className="text-red-700 text-lg">›</span>
        </button>

        {/* Version footer */}
        <p className="text-center text-neutral-800 text-xs mt-8 pb-4">
          FoodReels v1.0.0 · Made with ❤️ in India
        </p>
      </div>
    </div>
  );
}
