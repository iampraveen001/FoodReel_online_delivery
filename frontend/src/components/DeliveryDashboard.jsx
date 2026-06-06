import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:5000";

// ── Animated counter helper ────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = "", suffix = "" }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    let start = 0;
    const end = Number(value);
    const step = Math.ceil(end / 30);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(start);
    }, 25);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{prefix}{display}{suffix}</span>;
}

// ── Vehicle type options ──────────────────────────────────────────────────
const VEHICLE_TYPES = [
  { value: "bike",    label: "🏍️ Bike" },
  { value: "scooter", label: "🛵 Scooter" },
  { value: "bicycle", label: "🚲 Bicycle" },
  { value: "car",     label: "🚗 Car" },
];

export default function DeliveryDashboard({ user, token }) {
  // ── state ────────────────────────────────────────────────────────────────
  const [stats, setStats]               = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [isAvailable, setIsAvailable]       = useState(false);
  const [togglingAvail, setTogglingAvail]   = useState(false);

  const [vehicleType,   setVehicleType]   = useState(user?.deliveryInfo?.vehicleType   || "");
  const [vehicleNumber, setVehicleNumber] = useState(user?.deliveryInfo?.vehicleNumber || "");
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehicleMsg,    setVehicleMsg]    = useState(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);

  // ── fetch stats ────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      setStatsLoading(true);
      const res  = await fetch(`${API_BASE}/api/deliveryman/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.data) setStats(data.data);
    } catch (e) {
      console.error("fetchStats error:", e);
    } finally {
      setStatsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
    // refresh stats every 60 s
    const id = setInterval(fetchStats, 60_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  // Seed availability from user prop
  useEffect(() => {
    if (user?.deliveryInfo?.isAvailable !== undefined) {
      setIsAvailable(user.deliveryInfo.isAvailable);
    }
  }, [user]);

  // ── toggle availability ───────────────────────────────────────────────
  const toggleAvailability = async () => {
    if (togglingAvail) return;
    setTogglingAvail(true);
    try {
      const res  = await fetch(`${API_BASE}/api/deliveryman/availability`, {
        method:  "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.data !== undefined) {
        setIsAvailable(data.data.isAvailable);
      }
    } catch (e) {
      console.error("toggleAvailability error:", e);
    } finally {
      setTogglingAvail(false);
    }
  };

  // ── save vehicle info ─────────────────────────────────────────────────
  const saveVehicle = async () => {
    if (!vehicleType || !vehicleNumber.trim()) {
      setVehicleMsg("⚠️ Please select a vehicle type and enter a number.");
      return;
    }
    setSavingVehicle(true);
    setVehicleMsg(null);
    try {
      const res  = await fetch(`${API_BASE}/api/deliveryman/vehicle`, {
        method:  "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ vehicleType, vehicleNumber: vehicleNumber.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save vehicle.");
      setVehicleMsg("✅ Vehicle info saved!");
      setTimeout(() => { setVehicleMsg(null); setShowVehicleForm(false); }, 1500);
    } catch (e) {
      setVehicleMsg(`❌ ${e.message}`);
    } finally {
      setSavingVehicle(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── AVAILABILITY TOGGLE ─────────────────────────────────────────── */}
      <div className="flex items-center justify-end">
        {/* Availability pill */}
        <button
          id="delivery-availability-toggle"
          onClick={toggleAvailability}
          disabled={togglingAvail}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 font-bold text-xs transition-all duration-300 ${
            isAvailable
              ? "bg-green-500/15 border-green-500/50 text-green-400 shadow-[0_0_16px_rgba(34,197,94,0.2)]"
              : "bg-neutral-800 border-neutral-700 text-neutral-400"
          } ${togglingAvail ? "opacity-60 cursor-not-allowed" : "hover:scale-105"}`}
        >
          {togglingAvail ? (
            <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              isAvailable ? "bg-green-400 animate-pulse" : "bg-neutral-600"
            }`} />
          )}
          {isAvailable ? "ONLINE" : "OFFLINE"}
        </button>
      </div>

      {/* ── STATS GRID ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Today's Deliveries */}
        <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 relative overflow-hidden">
          <div className="absolute -top-3 -right-3 text-5xl opacity-10 select-none">📦</div>
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider mb-1">Today</p>
          <div className="text-orange-400 text-3xl font-black leading-none">
            {statsLoading
              ? <span className="w-8 h-7 bg-neutral-800 rounded animate-pulse inline-block" />
              : <AnimatedNumber value={stats?.todayDeliveries ?? 0} />}
          </div>
          <p className="text-white text-xs mt-1 font-medium">Deliveries</p>
        </div>

        {/* Total Earnings */}
        <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 relative overflow-hidden">
          <div className="absolute -top-3 -right-3 text-5xl opacity-10 select-none">💰</div>
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider mb-1">Earned</p>
          <div className="text-green-400 text-3xl font-black leading-none">
            {statsLoading
              ? <span className="w-16 h-7 bg-neutral-800 rounded animate-pulse inline-block" />
              : <AnimatedNumber value={stats?.totalEarnings ?? 0} prefix="₹" />}
          </div>
          <p className="text-white text-xs mt-1 font-medium">Total Earnings</p>
        </div>

        {/* Total Deliveries */}
        <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 relative overflow-hidden">
          <div className="absolute -top-3 -right-3 text-5xl opacity-10 select-none">🏆</div>
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider mb-1">All Time</p>
          <div className="text-purple-400 text-3xl font-black leading-none">
            {statsLoading
              ? <span className="w-10 h-7 bg-neutral-800 rounded animate-pulse inline-block" />
              : <AnimatedNumber value={stats?.totalDeliveries ?? 0} />}
          </div>
          <p className="text-white text-xs mt-1 font-medium">Deliveries</p>
        </div>

        {/* Rating */}
        <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 relative overflow-hidden">
          <div className="absolute -top-3 -right-3 text-5xl opacity-10 select-none">⭐</div>
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider mb-1">Rating</p>
          <div className="text-yellow-400 text-3xl font-black leading-none flex items-end gap-1">
            {statsLoading
              ? <span className="w-10 h-7 bg-neutral-800 rounded animate-pulse inline-block" />
              : (stats?.rating ?? 0).toFixed(1)}
          </div>
          <p className="text-white text-xs mt-1 font-medium">⭐ Customer Rating</p>
        </div>
      </div>

      {/* ── VEHICLE INFO ───────────────────────────────────────────────── */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        <button
          id="delivery-vehicle-toggle"
          onClick={() => { setShowVehicleForm((v) => !v); setVehicleMsg(null); }}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-neutral-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🛵</span>
            <div className="text-left">
              <p className="text-white text-sm font-bold">Vehicle Info</p>
              <p className="text-neutral-500 text-xs mt-0.5">
                {vehicleType && vehicleNumber
                  ? `${VEHICLE_TYPES.find((v) => v.value === vehicleType)?.label || vehicleType} · ${vehicleNumber}`
                  : "Set your vehicle details"}
              </p>
            </div>
          </div>
          <span
            className={`text-neutral-500 text-sm transition-transform duration-300 ${
              showVehicleForm ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </button>

        {showVehicleForm && (
          <div className="px-4 pb-4 space-y-3 border-t border-neutral-800 pt-3">
            {/* Vehicle Type Pills */}
            <div>
              <p className="text-neutral-500 text-[10px] uppercase tracking-wider mb-2">Vehicle Type</p>
              <div className="grid grid-cols-2 gap-2">
                {VEHICLE_TYPES.map((v) => (
                  <button
                    key={v.value}
                    id={`vehicle-type-${v.value}`}
                    onClick={() => setVehicleType(v.value)}
                    className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all duration-200 ${
                      vehicleType === v.value
                        ? "bg-orange-500/20 border-orange-500 text-orange-400"
                        : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Number */}
            <div>
              <p className="text-neutral-500 text-[10px] uppercase tracking-wider mb-2">Vehicle Number</p>
              <input
                id="delivery-vehicle-number"
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="e.g., UP70 AB 1234"
                className="w-full bg-neutral-800 border border-neutral-700 focus:border-orange-500 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-neutral-600 font-mono uppercase"
              />
            </div>

            {/* Save button */}
            <button
              id="delivery-vehicle-save"
              onClick={saveVehicle}
              disabled={savingVehicle}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
            >
              {savingVehicle ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "💾 Save Vehicle Info"
              )}
            </button>

            {/* Message */}
            {vehicleMsg && (
              <p className={`text-center text-xs font-medium ${
                vehicleMsg.startsWith("✅") ? "text-green-400" : "text-red-400"
              }`}>
                {vehicleMsg}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── REFRESH STATS ─────────────────────────────────────────────── */}
      <button
        id="delivery-stats-refresh"
        onClick={fetchStats}
        disabled={statsLoading}
        className="w-full py-2 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white text-xs font-medium transition-all flex items-center justify-center gap-2"
      >
        {statsLoading ? (
          <span className="w-3.5 h-3.5 border-2 border-neutral-600 border-t-neutral-300 rounded-full animate-spin" />
        ) : (
          "↻"
        )}
        Refresh Stats
      </button>
    </div>
  );
}
