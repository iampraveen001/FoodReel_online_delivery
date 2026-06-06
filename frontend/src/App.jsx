import { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { CartProvider } from "./hooks/useCart";
import Home from "./components/Home";
import { useToast } from "./hooks/useToast";
import BottomNav from "./components/BottomNav";
import ReelsScreen from "./components/ReelsScreen";
import CartScreen from "./components/CartScreen";
import TrackingScreen from "./components/TrackingScreen";
import ProfileScreen from "./components/ProfileScreen";
import LoginScreen from "./components/LoginScreen";
import OwnerScreen from "./components/OwnerScreen";
import PaymentScreen from "./components/PaymentScreen";
import Toast from "./components/Toast";
import logo from "./assets/logo.svg";

// ── Location Permission Modal ────────────────────────────────────────────────
function LocationPermissionModal({ role, onAllow, onSkip }) {
  const [requesting, setRequesting] = useState(false);

  const handleAllow = async () => {
    setRequesting(true);
    try {
      await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
        })
      );
      onAllow(true);
    } catch {
      onAllow(false);
    } finally {
      setRequesting(false);
    }
  };

  const isDelivery = role === "deliveryman";

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-end justify-center">
      <div className="w-full max-w-md bg-neutral-900 rounded-t-[2rem] border-t border-neutral-800 p-6 pb-10 shadow-2xl">
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-20 h-20 rounded-3xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-4xl shadow-lg shadow-orange-500/10">
            📍
          </div>
        </div>

        {/* Text */}
        <h2 className="text-white text-xl font-black text-center mb-2">
          Allow Location Access
        </h2>
        <p className="text-neutral-400 text-sm text-center leading-relaxed mb-6">
          {isDelivery
            ? "FoodReels needs your live location to show you nearby orders, navigate to customers, and update your delivery progress in real-time."
            : "FoodReels needs your location to show delivery ETAs, track orders on the map, and help customers find your restaurant faster."}
        </p>

        {/* Permission items */}
        <div className="space-y-2 mb-6">
          {[
            { icon: "🗺️", text: "Show your position on the live map" },
            { icon: isDelivery ? "📦" : "⏱️", text: isDelivery ? "Find & accept nearby delivery orders" : "Real-time order tracking for customers" },
            { icon: "🔒", text: "Location shared only during active sessions" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3 bg-neutral-800/60 rounded-2xl px-4 py-3">
              <span className="text-lg">{item.icon}</span>
              <span className="text-neutral-300 text-sm">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <button
          onClick={handleAllow}
          disabled={requesting}
          className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-black text-base transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 mb-3"
        >
          {requesting ? (
            <><span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Getting location...</>
          ) : (
            "📍 Allow Location Access"
          )}
        </button>
        <button
          onClick={onSkip}
          className="w-full py-3 rounded-2xl text-neutral-500 hover:text-neutral-300 text-sm font-medium transition-colors"
        >
          Not now — I'll enable it later
        </button>
      </div>
    </div>
  );
}

// Inner component that has access to router hooks
function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [activeOrder, setActiveOrder] = useState(null); // set after payment, passed to TrackingScreen
  const [showLocationModal, setShowLocationModal] = useState(false);
  const { toast, showToast } = useToast();

  const handleOrderPlaced = (order) => {
    showToast("🎉 Order placed! Track it");
    if (order) setActiveOrder(order); // eliminate fetch race in TrackingScreen
    setTimeout(() => navigate("/track"), 1200);
  };

  const handleAddToast = (name) => {
    showToast(`✅ ${name} Add in Cart!`);
  };

  const handleNavigate = (path) => {
    if (path === "/reels" && user?.role === "deliveryman") {
      showToast("🛵 Deliveryman can't see the reel");
      return;
    }
    navigate(path);
  };

  const handleLogin = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem("token", userToken);
    setIsLoggedIn(true);
    navigate(userData?.role === "deliveryman" ? "/track" : "/reels");
  };

  // Redirect deliveryman away from reels
  useEffect(() => {
    if (user?.role === "deliveryman" && location.pathname === "/reels") {
      navigate("/track");
    }
  }, [user?.role, location.pathname, navigate]);

  // Show location permission modal for owners and deliverymen after login
  useEffect(() => {
    if (!user?.role || !["owner", "deliveryman"].includes(user.role)) return;
    if (!navigator.geolocation) {
      showToast("⚠️ This browser does not support location services.");
      return;
    }
    // Check if permission was already granted — skip modal if so
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          // Already allowed — no modal needed
        } else {
          setShowLocationModal(true);
        }
      }).catch(() => setShowLocationModal(true));
    } else {
      setShowLocationModal(true);
    }
  }, [user?.role]);

  // Determine active tab from current path
  const pathToTab = {
    "/": "home",
    "/reels": "reels",
    "/cart": "cart",
    "/track": "track",
    "/profile": "profile",
    "/owner": "profile",
    "/payment": "cart",
    "/login": "profile",
  };
  const activeTab = pathToTab[location.pathname] ?? "home";

  return (
    <div className="min-h-screen min-w-full bg-neutral-950 flex flex-col">
      <div className="relative w-full h-screen bg-black overflow-hidden border border-neutral-800 shadow-none flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-3 bg-neutral-950/40 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Find Your Food" className="h-10 w-auto" />
            <span className="text-white text-sm font-semibold">FoodReels</span>
          </div>
          <div className="flex gap-2 items-center text-white text-xs">
            <span>Live GPS Tracking</span>
          </div>
        </div>

        {/* Location Permission Modal */}
        {showLocationModal && (
          <LocationPermissionModal
            role={user?.role}
            onAllow={(granted) => {
              setShowLocationModal(false);
              if (granted) {
                showToast("✅ Location access granted!");
              } else {
                showToast("⚠️ Location denied — some features may not work.");
              }
            }}
            onSkip={() => {
              setShowLocationModal(false);
              showToast("📍 You can enable location later in browser settings.");
            }}
          />
        )}

        {/* Toast */}
        <Toast msg={toast.msg} show={toast.show} />

        <main className="flex-1 overflow-y-auto pb-24">
          <Routes>
            {/* Home */}
            <Route
              path="/"
              element={<Home onSetScreen={(s) => handleNavigate(`/${s === "home" ? "" : s}`)} />}
            />

            {/* Reels */}
            <Route
              path="/reels"
              element={
                <ReelsScreen onAddToast={handleAddToast} user={user} token={token} />
              }
            />

            {/* Cart */}
            <Route
              path="/cart"
              element={
                <CartScreen
                  user={user}
                  token={token}
                  onProceedToPayment={(amount) => {
                    setTotalAmount(amount);
                    navigate("/payment");
                  }}
                />
              }
            />

            {/* Payment */}
            <Route
              path="/payment"
              element={
                <PaymentScreen
                  total={totalAmount}
                  token={token}
                  user={user}
                  onPaymentSuccess={handleOrderPlaced}
                  onBack={() => navigate("/cart")}
                />
              }
            />

            {/* Tracking */}
            <Route
              path="/track"
              element={<TrackingScreen user={user} token={token} initialOrder={activeOrder} />}
            />

            {/* Profile — shows login if not logged in */}
            <Route
              path="/profile"
              element={
                isLoggedIn ? (
                  <ProfileScreen
                    user={user}
                    token={token}
                    onProfileUpdate={(updatedUser) => setUser(updatedUser)}
                    onRestaurantClick={() => {
                      if (user?.role === "owner") {
                        navigate("/owner");
                      } else {
                        showToast("⚠️ Only Restaurant Owners can access the portal!");
                      }
                    }}
                    onLogout={() => {
                      setUser(null);
                      setToken(null);
                      localStorage.removeItem("token");
                      setIsLoggedIn(false);
                      navigate("/reels");
                      showToast("👋 Successfully logged out");
                    }}
                  />
                ) : (
                  <LoginScreen onLogin={handleLogin} />
                )
              }
            />

            {/* Login (standalone route) */}
            <Route
              path="/login"
              element={
                isLoggedIn
                  ? <Navigate to="/profile" replace />
                  : <LoginScreen onLogin={handleLogin} />
              }
            />

            {/* Owner Portal — protected */}
            <Route
              path="/owner"
              element={
                isLoggedIn && user?.role === "owner" ? (
                  <OwnerScreen
                    user={user}
                    token={token}
                    onBack={() => navigate("/profile")}
                  />
                ) : (
                  <Navigate to="/profile" replace />
                )
              }
            />

            {/* Orders */}
            <Route path="/orders" element={<Navigate to="/track" replace />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <div className="shrink-0">
          <BottomNav active={activeTab} onChange={handleNavigate} user={user} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </CartProvider>
  );
}
