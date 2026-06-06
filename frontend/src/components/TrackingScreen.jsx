import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { io } from "socket.io-client";
import { deliveryPerson } from "../data/foods";
import { GoogleMap, useJsApiLoader, Marker, Polyline } from "@react-google-maps/api";
import DeliveryDashboard from "./DeliveryDashboard";

const MAPS_API_KEY =  import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const API_BASE = import.meta.env.VITE_API_URL;

// Haversine formula — returns distance in km between two GPS coords
const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// Format km nicely: "0.3 km" or "1.5 km"
const fmtDist = (km) => (km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`);

const ORDER_STEPS = [
  { icon: "✅", label: "Order\nReceived", key: "received" },
  { icon: "👨‍🍳", label: "Preparing", key: "preparing" },
  { icon: "🛵", label: "On the way", key: "onway" },
  { icon: "🏠", label: "Delivered", key: "delivered" },
];

// Default map center (Prayagraj)
const DEFAULT_CENTER = { lat: 25.4358, lng: 81.8463 };

export default function TrackingScreen({ user, token, initialOrder = null }) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: MAPS_API_KEY,
  });

  // ── State ──────────────────────────────────────────────────
  // Seed from initialOrder prop (passed right after payment) to avoid fetch race
  const [activeOrder, setActiveOrder] = useState(initialOrder);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [customerAddress, setCustomerAddress] = useState(null);
  const [customerCity, setCustomerCity] = useState(null);
  const [deliverymanLocation, setDeliverymanLocation] = useState(null);
  const [deliverymanAddress, setDeliverymanAddress] = useState(null);
  const [deliverymanCity, setDeliverymanCity] = useState(null);

  // Deliveryman sharing toggle
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState("Initialising...");
  const [locationError, setLocationError] = useState(null);

  // Available orders for deliveryman to pick up
  const [availableOrders, setAvailableOrders] = useState([]);
  const [acceptingOrderId, setAcceptingOrderId] = useState(null);
  const [deliveredOrderId, setDeliveredOrderId] = useState(null);

  // Animated demo progress (for customers without active order)
  const [eta, setEta] = useState(12);
  const [step, setStep] = useState(2);

  // ── Refs ───────────────────────────────────────────────────
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const mapRef = useRef(null);
  const intervalRef = useRef(null);

  // ── Map centre ─────────────────────────────────────────────
  const mapCenter = useMemo(() => {
    // Deliveryman should see customer location (their delivery destination)
    if (user?.role === "deliveryman" && customerLocation) return customerLocation;
    // Customer should see where the rider is
    if (deliverymanLocation) return deliverymanLocation;
    if (customerLocation) return customerLocation;
    return DEFAULT_CENTER;
  }, [user?.role, deliverymanLocation, customerLocation]);

  // ── Geocode helper ─────────────────────────────────────────
  const geocode = useCallback(async (lat, lng, setAddress, setCity) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_API_KEY}`
      );
      const data = await res.json();
      if (data.results?.[0]) {
        setAddress(data.results[0].formatted_address);
        const cityComp = data.results[0].address_components.find((c) =>
          c.types.includes("locality")
        );
        if (cityComp) setCity(cityComp.long_name);
      }
    } catch (e) {
      console.error("Geocode error:", e);
    }
  }, []);

  // ── Connect Socket (once per session) ─────────────────────
  useEffect(() => {
    if (!token) return;
    const socket = io(API_BASE, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => console.log("🔌 Socket connected:", socket.id));
    socket.on("disconnect", () => console.log("🔌 Socket disconnected"));

    // Customer receives deliveryman location updates
    socket.on("location_update", (loc) => {
      if (loc?.lat && loc?.lng) {
        setDeliverymanLocation({ lat: loc.lat, lng: loc.lng });
        geocode(loc.lat, loc.lng, setDeliverymanAddress, setDeliverymanCity);
        setLocationStatus("Deliveryman location live 🛵");
      }
    });

    // Deliveryman receives customer location updates via socket
    socket.on("customer_location_update", (loc) => {
      if (loc?.lat && loc?.lng) {
        setCustomerLocation({ lat: loc.lat, lng: loc.lng });
        geocode(loc.lat, loc.lng, setCustomerAddress, setCustomerCity);
        setLocationStatus("Customer location live 🏠");
        // Pan map to customer location so deliveryman can see destination
        if (mapRef.current) mapRef.current.panTo({ lat: loc.lat, lng: loc.lng });
      }
    });

    // Deliveryman: server pushes 'order_assigned' when a new order is assigned
    socket.on("order_assigned", ({ orderId, customerLocation: custLoc }) => {
      if (user?.role !== "deliveryman") return;
      // Join the order room so we receive location updates
      socket.emit("join_order", orderId);
      // Pre-populate customer location from the assignment payload
      if (custLoc?.lat && custLoc?.lng) {
        setCustomerLocation({ lat: custLoc.lat, lng: custLoc.lng });
        geocode(custLoc.lat, custLoc.lng, setCustomerAddress, setCustomerCity);
      }
      // Refresh order data
      setActiveOrder((prev) => prev || { _id: orderId });
      setLocationStatus("New order assigned! Acquiring GPS...");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // ── Fetch active order + join socket room + poll customer loc ─
  useEffect(() => {
    if (!token || !user?.role) return;

    const fetchOrder = async () => {
      try {
        const endpoint =
          user.role === "deliveryman"
            ? `${API_BASE}/api/orders/deliveryman/mine`
            : `${API_BASE}/api/orders/my`;

        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.data?.orders) {
          const active = data.data.orders.find(
            (o) => !["delivered", "cancelled"].includes(o.status)
          );
          if (active) {
            setActiveOrder(active);

            // Join the order Socket.IO room FIRST, then listeners handle events
            socketRef.current?.emit("join_order", active._id);

            if (user.role === "deliveryman") {
              setLocationStatus("Acquiring GPS signal...");
              // Load customer location that was already saved in the order
              if (active.customerLocation?.lat && active.customerLocation?.lng) {
                setCustomerLocation(active.customerLocation);
                geocode(
                  active.customerLocation.lat,
                  active.customerLocation.lng,
                  setCustomerAddress,
                  setCustomerCity
                );
              }
            } else {
              setLocationStatus("Sharing your location with the deliveryman 📍");
            }
            return;
          }
        }
        setActiveOrder(null);
        setLocationStatus(
          user.role === "deliveryman"
            ? "No active delivery assigned yet."
            : "No active order found."
        );
      } catch (err) {
        console.error("fetchOrder error:", err);
        setLocationStatus("Unable to load order data.");
      }
    };

    // If initialOrder was passed (right after payment), use it immediately —
    // skip the fetch to avoid the race condition where the socket room is
    // joined before the order even exists in the DB cache.
    if (initialOrder && !activeOrder) {
      setActiveOrder(initialOrder);
      socketRef.current?.emit("join_order", initialOrder._id);
      if (user.role === "customer") {
        setLocationStatus("Sharing your location with the deliveryman 📍");
      } else if (user.role === "deliveryman") {
        if (initialOrder.customerLocation?.lat) {
          setCustomerLocation(initialOrder.customerLocation);
          geocode(
            initialOrder.customerLocation.lat,
            initialOrder.customerLocation.lng,
            setCustomerAddress,
            setCustomerCity
          );
        }
        setLocationStatus("Acquiring GPS signal...");
      }
      return; // skip fetch
    }

    fetchOrder();
  }, [token, user?.role]);

  // ── DELIVERYMAN: poll customer location from backend every 15s ─
  // This handles the case where socket events were missed (app opened after
  // customer already shared location, or socket reconnect scenarios)
  useEffect(() => {
    if (!activeOrder || user?.role !== "deliveryman" || !token) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/orders/${activeOrder._id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (res.ok && data.data?.order?.customerLocation?.lat) {
          const loc = data.data.order.customerLocation;
          setCustomerLocation({ lat: loc.lat, lng: loc.lng });
          geocode(loc.lat, loc.lng, setCustomerAddress, setCustomerCity);
        }
      } catch (e) {
        console.error("Customer location poll error:", e);
      }
    };

    // Run immediately, then every 15 seconds
    poll();
    const pollInterval = setInterval(poll, 15000);
    return () => clearInterval(pollInterval);
  }, [activeOrder, user?.role, token]);

  // ── CUSTOMER: watch own GPS and share with backend ─────────
  useEffect(() => {
    if (!activeOrder || user?.role !== "customer" || !navigator.geolocation) return;

    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCustomerLocation(coords);
        geocode(coords.lat, coords.lng, setCustomerAddress, setCustomerCity);

        // Persist to backend (also emits socket event to deliveryman)
        fetch(`${API_BASE}/api/orders/${activeOrder._id}/customer-location`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(coords),
        }).catch(console.error);

        setLocationStatus("Sharing your location with deliveryman ✅");
      },
      (err) => {
        setLocationError("Location access denied. Enable GPS to share your location.");
        setLocationStatus("GPS unavailable.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    watchIdRef.current = wid;
    return () => {
      navigator.geolocation.clearWatch(wid);
      watchIdRef.current = null;
    };
  }, [activeOrder, user?.role, token]);

  // ── DELIVERYMAN: auto-start sharing when activeOrder is set ─
  useEffect(() => {
    if (!activeOrder || user?.role !== "deliveryman" || !navigator.geolocation) return;
    // Don't start a second watcher if already running
    if (watchIdRef.current !== null) return;

    setLocationError(null);
    setIsSharingLocation(true);
    setLocationStatus("Acquiring GPS signal...");

    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        setDeliverymanLocation((prev) => {
          // Pan map to new position on first fix
          if (!prev && mapRef.current) {
            mapRef.current.panTo(coords);
            mapRef.current.setZoom(16);
          }
          return coords;
        });
        geocode(coords.lat, coords.lng, setDeliverymanAddress, setDeliverymanCity);

        // Broadcast via persistent Socket.IO
        socketRef.current?.emit("send_location", {
          orderId: activeOrder._id,
          lat: coords.lat,
          lng: coords.lng,
        });

        // Persist to backend (updates order + emits to customer)
        fetch(`${API_BASE}/api/orders/${activeOrder._id}/location`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(coords),
        }).catch(console.error);

        setLocationStatus("Broadcasting live location 📡");
      },
      (err) => {
        setLocationError(
          err.code === 1
            ? "GPS permission denied. Please allow location access in your browser settings."
            : "GPS signal lost. Make sure location services are enabled."
        );
        setIsSharingLocation(false);
        setLocationStatus("Location sharing stopped.");
        watchIdRef.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
    watchIdRef.current = wid;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeOrder, user?.role, token]);

  const stopSharingLocation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharingLocation(false);
    setLocationStatus("Location sharing paused.");
  }, []);

  // Start sharing without requiring an active order (deliveryman goes online)
  const startSharingLocation = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;
    setLocationError(null);
    setIsSharingLocation(true);
    setLocationStatus("Acquiring GPS signal...");

    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDeliverymanLocation((prev) => {
          if (!prev && mapRef.current) {
            mapRef.current.panTo(coords);
            mapRef.current.setZoom(16);
          }
          return coords;
        });
        geocode(coords.lat, coords.lng, setDeliverymanAddress, setDeliverymanCity);

        // Broadcast on the order room if we have an order
        if (activeOrder?._id) {
          socketRef.current?.emit("send_location", {
            orderId: activeOrder._id,
            lat: coords.lat,
            lng: coords.lng,
          });
          fetch(`${API_BASE}/api/orders/${activeOrder._id}/location`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(coords),
          }).catch(console.error);
        } else {
          // No order yet — broadcast to deliveryman's own room so restaurants/admin can see
          socketRef.current?.emit("deliveryman_location", {
            deliverymanId: user?._id,
            lat: coords.lat,
            lng: coords.lng,
          });
        }
        setLocationStatus("Broadcasting live location 📡");
      },
      (err) => {
        setLocationError(
          err.code === 1
            ? "GPS permission denied. Please allow location access in your browser settings."
            : "GPS signal lost. Make sure location services are enabled."
        );
        setIsSharingLocation(false);
        setLocationStatus("Location sharing stopped.");
        watchIdRef.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
    watchIdRef.current = wid;
  }, [activeOrder, token, user?._id, geocode]);

  const resumeSharingLocation = useCallback(() => {
    startSharingLocation();
  }, [startSharingLocation]);

  // ── DELIVERYMAN: fetch nearby available orders ─────────────
  // Polls every 20s when sharing location but has no active order
  useEffect(() => {
    if (user?.role !== "deliveryman" || !token || activeOrder) return;

    const fetchAvailable = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/orders/available`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.data?.orders) {
          setAvailableOrders(data.data.orders);
        }
      } catch (e) {
        console.error("fetchAvailable error:", e);
      }
    };

    fetchAvailable();
    const id = setInterval(fetchAvailable, 20000);
    return () => clearInterval(id);
  }, [user?.role, token, activeOrder]);

  // ── DELIVERYMAN: accept an order ───────────────────────────
  const takeOrder = useCallback(async (orderId) => {
    setAcceptingOrderId(orderId);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not accept order.");

      const order = data.data?.order;
      setActiveOrder(order);
      setAvailableOrders([]);
      // Join the order socket room immediately
      socketRef.current?.emit("join_order", orderId);
      // Load customer location from order if available
      if (order?.customerLocation?.lat) {
        setCustomerLocation({ lat: order.customerLocation.lat, lng: order.customerLocation.lng });
        geocode(order.customerLocation.lat, order.customerLocation.lng, setCustomerAddress, setCustomerCity);
      }
      setLocationStatus("Order accepted! Broadcasting your location 📡");
    } catch (err) {
      console.error("takeOrder error:", err);
    } finally {
      setAcceptingOrderId(null);
    }
  }, [token, geocode]);

  // ── DELIVERYMAN: mark delivered ────────────────────────────
  const markDelivered = useCallback(async () => {
    if (!activeOrder) return;
    setDeliveredOrderId(activeOrder._id);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${activeOrder._id}/deliver`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      // Clear active order — deliveryman is now free
      setActiveOrder(null);
      setCustomerLocation(null);
      setCustomerAddress(null);
      setCustomerCity(null);
      setLocationStatus("Delivery complete! Ready for next order 🎉");
    } catch (err) {
      console.error("markDelivered error:", err);
    } finally {
      setDeliveredOrderId(null);
    }
  }, [activeOrder, token]);

  // ── Animated demo countdown (always runs for ETA display) ─
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setEta((p) => Math.max(0, p - 1));
    }, 60000); // countdown every real minute
    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // ── Map loaded callback ────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);


  // ── Derived display city ───────────────────────────────────
  const displayCity =
    (user?.role === "deliveryman" ? deliverymanCity : customerCity) || "Prayagraj";

  // ────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden pb-16">
      {/* ── MAP ─────────────────────────────────────────────── */}
      <div className="relative h-72 bg-neutral-950 overflow-hidden border-b border-neutral-800 shrink-0">
        {!isLoaded ? (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-500 font-bold animate-pulse">
            Loading Live Map...
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={mapCenter}
            zoom={15}
            onLoad={onMapLoad}
            options={{
              mapTypeId: "satellite",
              disableDefaultUI: true,
              gestureHandling: "greedy",
            }}
          >
            {/* 🛵 Deliveryman marker */}
            {deliverymanLocation && (
              <Marker
                position={deliverymanLocation}
                icon={{
                  url: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56' width='56' height='56'%3E%3Ccircle cx='28' cy='28' r='26' fill='%23FF4D00' opacity='0.25'/%3E%3Ctext x='28' y='38' font-size='30' text-anchor='middle' font-family='system-ui'%3E🛵%3C/text%3E%3C/svg%3E",
                  scaledSize: new window.google.maps.Size(56, 56),
                  anchor: new window.google.maps.Point(28, 28),
                }}
                title="Deliveryman"
              />
            )}

            {/* 🏠 Customer marker */}
            {customerLocation && (
              <Marker
                position={customerLocation}
                icon={{
                  url: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56' width='56' height='56'%3E%3Ccircle cx='28' cy='28' r='26' fill='%231d4ed8' opacity='0.25'/%3E%3Ctext x='28' y='38' font-size='30' text-anchor='middle' font-family='system-ui'%3E🏠%3C/text%3E%3C/svg%3E",
                  scaledSize: new window.google.maps.Size(56, 56),
                  anchor: new window.google.maps.Point(28, 28),
                }}
                title="Customer Home"
              />
            )}

            {/* Route line when both positions are known */}
            {deliverymanLocation && customerLocation && (
              <Polyline
                path={[deliverymanLocation, customerLocation]}
                options={{
                  strokeColor: "#FF4D00",
                  strokeOpacity: 0.85,
                  strokeWeight: 4,
                }}
              />
            )}
          </GoogleMap>
        )}

        {/* City name overlay */}
        <div className="absolute top-3 left-3 z-20 bg-black/70 backdrop-blur-md text-white font-bold text-xs px-3 py-2 rounded-xl border border-white/10 shadow-lg pointer-events-none flex items-center gap-1.5">
          <span className="text-orange-400">📍</span>
          <span>{displayCity}</span>
        </div>

        {/* Live indicator */}
        <div
          className={`absolute top-3 right-3 z-20 bg-black/70 backdrop-blur-md font-bold text-[10px] px-3 py-2 rounded-xl border border-white/10 shadow-lg pointer-events-none flex items-center gap-1.5 ${
            isSharingLocation || deliverymanLocation
              ? "text-green-400"
              : "text-neutral-500"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full inline-block ${
              isSharingLocation || deliverymanLocation
                ? "bg-green-400 animate-pulse"
                : "bg-neutral-500"
            }`}
          />
          {isSharingLocation || deliverymanLocation ? "LIVE" : "OFFLINE"}
        </div>
      </div>

      {/* ── INFO SECTION ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-neutral-950">

        {/* Status badge — hidden for deliverymen (they have their own dashboard) */}
        {user?.role !== "deliveryman" && (
          <div className="inline-flex items-center gap-2 bg-green-500/15 text-green-400 rounded-full px-4 py-1.5 text-xs font-medium">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {step === 3 ? "Delivered! 🎉" : "Out for Delivery"}
          </div>
        )}

        {/* ── DELIVERYMAN: Stats / Availability / Vehicle Dashboard ── */}
        {user?.role === "deliveryman" && (
          <DeliveryDashboard user={user} token={token} />
        )}

        {/* ── DELIVERYMAN: Live Location Panel ──────────────── */}
        {user?.role === "deliveryman" && (
          <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white text-sm font-bold">🛵 Location Sharing</p>
                <p className="text-neutral-500 text-xs mt-0.5">
                  {activeOrder
                    ? `Order #${activeOrder.orderNumber || activeOrder._id?.slice(-6).toUpperCase()}`
                    : "No active order"}
                </p>
              </div>
              {/* Live / Paused badge */}
              <span
                className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  isSharingLocation
                    ? "bg-green-500/15 text-green-400"
                    : "bg-neutral-800 text-neutral-500"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block ${
                    isSharingLocation ? "bg-green-400 animate-pulse" : "bg-neutral-500"
                  }`}
                />
                {isSharingLocation ? "LIVE" : "OFFLINE"}
              </span>
            </div>

            {/* ── Big Toggle Switch ─────────────────────────── */}
            <button
              onClick={isSharingLocation ? stopSharingLocation : startSharingLocation}
              className={`w-full relative flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all duration-300 ${
                isSharingLocation
                  ? "bg-green-500/10 border-green-500/40 shadow-[0_0_24px_rgba(34,197,94,0.12)]"
                  : "bg-neutral-800/60 border-neutral-700 hover:border-neutral-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all duration-300 ${
                    isSharingLocation
                      ? "bg-green-500 shadow-lg shadow-green-500/30"
                      : "bg-neutral-700"
                  }`}
                >
                  📡
                </div>
                <div className="text-left">
                  <p className={`text-sm font-bold ${isSharingLocation ? "text-white" : "text-neutral-400"}`}>
                    {isSharingLocation ? "Sharing My Location" : "Start Sharing Location"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {locationStatus}
                  </p>
                </div>
              </div>

              {/* Toggle pill */}
              <div
                className={`relative w-14 h-7 rounded-full transition-all duration-300 flex-shrink-0 ${
                  isSharingLocation ? "bg-green-500" : "bg-neutral-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
                    isSharingLocation ? "left-8" : "left-1"
                  }`}
                />
              </div>
            </button>

            {/* Error alert */}
            {locationError && (
              <div className="mt-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl mt-0.5">⚠️</span>
                  <div>
                    <p className="text-red-400 text-sm font-semibold">
                      {locationError.includes("denied")
                        ? "Location permission blocked"
                        : "GPS signal lost"}
                    </p>
                    <p className="text-red-300/70 text-xs mt-0.5 leading-relaxed">
                      {locationError.includes("denied")
                        ? "Open your browser settings → Site Settings → Location → Allow for this site."
                        : "Make sure GPS is enabled on your device and you have a clear sky view."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={resumeSharingLocation}
                  className="w-full py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-bold text-sm transition-colors"
                >
                  🔄 Retry Location Access
                </button>
              </div>
            )}

            {/* Live position card — shown when GPS is active */}
            {deliverymanLocation && (
              <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-orange-400 text-xs font-bold uppercase tracking-wider">
                    📍 Your Live Position
                  </div>
                  <div className="text-orange-300 text-[10px] font-mono">
                    {deliverymanLocation.lat.toFixed(5)}, {deliverymanLocation.lng.toFixed(5)}
                  </div>
                </div>
                <div className="text-white text-sm leading-snug">
                  {deliverymanAddress
                    ? deliverymanAddress
                    : "Resolving address..."}
                </div>
                {deliverymanCity && (
                  <div className="text-orange-300 text-xs mt-0.5 font-semibold">{deliverymanCity}</div>
                )}
              </div>
            )}

            {/* Waiting for GPS fix */}
            {isSharingLocation && !deliverymanLocation && (
              <div className="mt-3 p-3 bg-neutral-800/60 rounded-xl flex items-center gap-2">
                <span className="text-lg animate-spin">⏳</span>
                <p className="text-neutral-400 text-sm">Waiting for GPS fix...</p>
              </div>
            )}

            {/* Delivery destination — only when active order */}
            {customerLocation && activeOrder && (
              <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
                  🏠 Deliver To
                </div>
                <div className="text-white text-sm leading-snug">
                  {customerAddress
                    ? customerAddress
                    : `${customerLocation.lat.toFixed(5)}, ${customerLocation.lng.toFixed(5)}`}
                </div>
                {customerCity && (
                  <div className="text-blue-300 text-xs mt-0.5 font-semibold">{customerCity}</div>
                )}
              </div>
            )}

            {/* ── Mark Delivered button ── shown when deliveryman is near customer */}
            {activeOrder && customerLocation && deliverymanLocation && (() => {
              const dist = haversineKm(deliverymanLocation, customerLocation);
              return dist <= 0.5; // within 500 m
            })() && (
              <button
                onClick={markDelivered}
                disabled={deliveredOrderId === activeOrder._id}
                className="mt-3 w-full py-3.5 rounded-2xl bg-green-500 hover:bg-green-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-black text-sm transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
              >
                {deliveredOrderId === activeOrder._id ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Marking...
                  </>
                ) : (
                  <>✅ Mark as Delivered</>
                )}
              </button>
            )}

            {/* ── Distance to customer ── when both locations known */}
            {activeOrder && customerLocation && deliverymanLocation && (
              <div className="mt-3 flex items-center justify-between px-3 py-2 bg-neutral-800/60 rounded-xl">
                <span className="text-neutral-400 text-xs">📏 Distance to customer</span>
                <span className="text-white text-xs font-bold">
                  {fmtDist(haversineKm(deliverymanLocation, customerLocation))}
                </span>
              </div>
            )}

            {/* ── Available Orders ── shown when no active order */}
            {!activeOrder && (
              <div className="mt-3">
                {availableOrders.length === 0 ? (
                  <div className="flex flex-col items-center py-4 gap-2">
                    <span className="text-3xl">🔍</span>
                    <p className="text-neutral-600 text-xs text-center leading-relaxed">
                      {isSharingLocation
                        ? "Searching for nearby orders... You'll be notified when one is available."
                        : "Toggle on to go online. Your location will be shared with customers and restaurants."}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-neutral-400 text-xs uppercase tracking-wider font-bold mb-2">
                      📦 Available Orders ({availableOrders.length})
                    </p>
                    <div className="space-y-2">
                      {availableOrders.map((order) => {
                        const restLat = order.restaurant?.address?.lat;
                        const restLng = order.restaurant?.address?.lng;
                        const dist = deliverymanLocation && restLat && restLng
                          ? haversineKm(deliverymanLocation, { lat: restLat, lng: restLng })
                          : null;
                        const isAccepting = acceptingOrderId === order._id;

                        return (
                          <div
                            key={order._id}
                            className="bg-neutral-800/70 border border-neutral-700 rounded-2xl p-3"
                          >
                            {/* Restaurant + distance */}
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="text-white text-sm font-bold">
                                  🍽️ {order.restaurant?.name || "Restaurant"}
                                </p>
                                <p className="text-neutral-500 text-xs mt-0.5">
                                  #{order.orderNumber || order._id?.slice(-6).toUpperCase()} · {order.items?.length || 0} items
                                </p>
                              </div>
                              {dist !== null && (
                                <span
                                  className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                                    dist <= 1
                                      ? "bg-green-500/20 text-green-400"
                                      : dist <= 3
                                      ? "bg-yellow-500/20 text-yellow-400"
                                      : "bg-neutral-700 text-neutral-400"
                                  }`}
                                >
                                  {fmtDist(dist)}
                                </span>
                              )}
                            </div>

                            {/* Order value */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-orange-400 text-sm font-black">₹{order.total}</div>
                              <div className="text-neutral-500 text-xs">
                                {order.customer?.name || "Customer"}
                              </div>
                            </div>

                            {/* Take Order button */}
                            <button
                              onClick={() => takeOrder(order._id)}
                              disabled={!!acceptingOrderId}
                              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold text-sm transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-2"
                            >
                              {isAccepting ? (
                                <>
                                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                  Accepting...
                                </>
                              ) : (
                                <>🛵 Take This Order</>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CUSTOMER: Deliveryman tracking panel ──────────── */}
        {user?.role === "customer" && (
          <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-neutral-400 text-xs uppercase tracking-wider font-bold">
                📍 Live Tracking
              </p>
              <span className="text-neutral-500 text-[10px]">{locationStatus}</span>
            </div>

            {locationError && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                ⚠️ {locationError}
              </div>
            )}

            {/* Deliveryman live position */}
            {deliverymanLocation ? (
              <div className="mb-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <div className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
                  🛵 Deliveryman Location
                </div>
                <div className="text-white text-sm">
                  {deliverymanAddress
                    ? deliverymanAddress
                    : `${deliverymanLocation.lat.toFixed(5)}, ${deliverymanLocation.lng.toFixed(5)}`}
                </div>
                {deliverymanCity && (
                  <div className="text-orange-300 text-xs mt-0.5 font-semibold">
                    {deliverymanCity}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-3 p-3 bg-neutral-800/50 rounded-xl">
                <p className="text-neutral-500 text-sm">
                  {activeOrder
                    ? "Waiting for deliveryman to start sharing location..."
                    : "No active order found."}
                </p>
              </div>
            )}

            {/* Your location */}
            {customerLocation && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="text-green-400 text-xs font-bold uppercase tracking-wider mb-1">
                  📍 Your Location
                </div>
                <div className="text-white text-sm">
                  {customerAddress
                    ? customerAddress
                    : `${customerLocation.lat.toFixed(5)}, ${customerLocation.lng.toFixed(5)}`}
                </div>
                {customerCity && (
                  <div className="text-green-300 text-xs mt-0.5 font-semibold">
                    {customerCity}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ETA Card ──────────────────────────────────────── */}
        <div className="bg-neutral-900 rounded-2xl p-4 flex items-center gap-4 border border-neutral-800">
          <div>
            <div className="text-orange-400 text-4xl font-black">{eta}</div>
            <div className="text-neutral-500 text-xs mt-0.5">min estimated</div>
          </div>
          <div className="flex-1" />
          <div className="text-right">
            <div className="text-white text-sm font-semibold">Out For Delivery</div>
            <div className="text-neutral-500 text-xs mt-0.5">
              {activeOrder
                ? `#${activeOrder.orderNumber || activeOrder._id?.slice(-6).toUpperCase()}`
                : "—"}
            </div>
          </div>
        </div>

        {/* ── Delivery person card ───────────────────────────── */}
        <div className="bg-neutral-900 rounded-2xl p-4 flex items-center gap-3 border border-neutral-800">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/30 rounded-full flex items-center justify-center text-xl">
            {deliveryPerson.avatar}
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold">{deliveryPerson.name}</p>
            <p className="text-yellow-400 text-xs">
              ⭐ {deliveryPerson.rating} · {deliveryPerson.deliveries} deliveries
            </p>
            <p className="text-neutral-400 text-xs">{deliveryPerson.phone}</p>
          </div>
          <button className="bg-neutral-800 border border-neutral-700 text-white text-xs rounded-full px-4 py-2 hover:bg-orange-500/20 hover:border-orange-500/30 hover:text-orange-400 transition-all">
            📞 Call
          </button>
        </div>

        {/* ── Progress steps ─────────────────────────────────── */}
        <div className="flex items-center px-1 pb-2">
          {ORDER_STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all duration-300 ${
                    i < step
                      ? "bg-green-500/20 border-green-500 scale-105"
                      : i === step
                      ? "bg-orange-500/20 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                      : "bg-neutral-800 border-neutral-700"
                  }`}
                >
                  {s.icon}
                </div>
                <span className="text-[9px] text-neutral-500 text-center leading-tight whitespace-pre-line font-medium mt-1">
                  {s.label}
                </span>
              </div>
              {i < ORDER_STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mb-6 transition-all duration-500 ${
                    i < step ? "bg-green-500" : "bg-neutral-800"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
