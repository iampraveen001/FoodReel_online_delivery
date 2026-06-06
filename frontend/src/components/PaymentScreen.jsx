import { useState, useCallback } from "react";
import { useCart } from "../hooks/useCart";

// Attempt to grab the device GPS once — resolves with coords or null on failure
const getGpsOnce = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });

export default function PaymentScreen({ total, token, user, onPaymentSuccess, onBack }) {
  const [selectedMethod, setSelectedMethod] = useState("upi");
  const [processing, setProcessing] = useState(false);
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState(null);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [error, setError] = useState(null);
  const [gpsStatus, setGpsStatus] = useState(null); // null | 'fetching' | 'ok' | 'skipped'
  const { cart, clearCart } = useCart();

  // Build the order payload from cart — also captures GPS once
  const buildOrderPayload = useCallback(async () => {
    if (!cart || cart.length === 0) return null;

    // All items should be from the same restaurant
    const restaurantId = cart[0]?.restaurantId;
    if (!restaurantId) return null;

    const items = cart.map((item) => ({
      foodItemId: item.foodItemId || item.id,
      qty: item.qty,
    }));

    // Build delivery address from user profile or use a placeholder
    const userAddr = user?.addresses?.[0];
    const deliveryAddress = userAddr
      ? {
          line1: userAddr.line1 || "My Location",
          city: userAddr.city || "City",
          state: userAddr.state || "State",
          pincode: userAddr.pincode || "000000",
          lat: userAddr.lat || null,
          lng: userAddr.lng || null,
        }
      : {
          line1: "Home",
          city: "City",
          state: "State",
          pincode: "000000",
        };

    // Capture GPS right now so deliveryman knows where to go immediately
    setGpsStatus("fetching");
    const customerLocation = await getGpsOnce();
    setGpsStatus(customerLocation ? "ok" : "skipped");

    // Map UI method IDs to backend enum values
    const methodMap = { upi: "upi", card: "online", cod: "cod" };
    const paymentMethod = methodMap[selectedMethod] || "cod";

    return { restaurantId, items, deliveryAddress, paymentMethod, ...(customerLocation && { customerLocation }) };
  }, [cart, user, selectedMethod]);

  // Place the order in MongoDB
  const placeOrderInDB = async () => {
    const payload = await buildOrderPayload();
    if (!payload) throw new Error("Cart is empty or missing restaurant info.");

    const res = await fetch("http://localhost:5000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to place order.");
    return data.data.order;
  };

  const handlePay = async () => {
    setProcessing(true);
    setError(null);

    if (selectedMethod === "cod") {
      // COD: save order to MongoDB then proceed
      try {
        const order = await placeOrderInDB();
        setPlacedOrder(order);
        clearCart();
        onPaymentSuccess(order);
      } catch (err) {
        setError(err.message || "Failed to place order.");
        setProcessing(false);
      }
      return;
    }

    // Online payment: first save order, then open Razorpay
    try {
      // 1. Save order in MongoDB
      const order = await placeOrderInDB();
      setPlacedOrder(order);

      // 2. Create Razorpay payment order
      const res = await fetch("http://localhost:5000/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: total }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setRazorpayOrder(data.data);
      setShowRazorpay(true);
    } catch (err) {
      setError(err.message || "Failed to initialize payment.");
    } finally {
      setProcessing(false);
    }
  };

  const handleMockRazorpaySuccess = async () => {
    setShowRazorpay(false);
    setProcessing(true);
    try {
      const res = await fetch("http://localhost:5000/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          razorpay_order_id: razorpayOrder.order.id,
          razorpay_payment_id: "pay_mocked_123456",
          razorpay_signature: "mock_secure_signature",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      clearCart();
      onPaymentSuccess(placedOrder);
    } catch (err) {
      setError(err.message || "Payment Verification Failed.");
      setProcessing(false);
    }
  };

  const methods = [
    { id: "upi", name: "UPI (GPay, PhonePe, Paytm)", icon: "📱", desc: "Fast & Secure" },
    { id: "card", name: "Credit / Debit Card", icon: "💳", desc: "Visa, MasterCard, RuPay" },
    { id: "cod", name: "Cash on Delivery", icon: "💵", desc: "Pay at your doorstep" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden pb-6 bg-neutral-950 absolute inset-0 z-50 rounded-[2.5rem]">
      {/* Header */}
      <div className="sticky top-0 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 px-6 py-5 flex items-center gap-4 z-10 w-full pt-8">
        <button onClick={!processing ? onBack : undefined} className={`w-9 h-9 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 transition-colors rounded-full text-white font-bold text-lg ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}>
          ←
        </button>
        <h2 className="text-white text-xl font-black flex-1">Complete Payment</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 relative">
        
        {/* Bill Summary Box */}
        <div className="bg-neutral-900 rounded-3xl p-6 mb-8 border border-neutral-800 shadow-xl text-center flex flex-col items-center justify-center">
          <p className="text-neutral-400 text-sm font-semibold mb-2 uppercase tracking-widest">Amount to Pay</p>
          <h1 className="text-5xl font-black text-orange-500 mb-2">₹{total}</h1>
          <p className="text-neutral-500 text-xs">Includes GST and delivery charges</p>
        {/* GPS status indicator */}
          {gpsStatus && (
            <div className={`flex items-center justify-center gap-2 mt-3 text-xs font-medium ${
              gpsStatus === "fetching" ? "text-orange-400" :
              gpsStatus === "ok"       ? "text-green-400"  : "text-neutral-500"
            }`}>
              {gpsStatus === "fetching" && (
                <><span className="w-3 h-3 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" /> Getting your GPS location...</>
              )}
              {gpsStatus === "ok"      && <>✅ Location captured for faster delivery</>}
              {gpsStatus === "skipped" && <>📍 Location unavailable — you can share it manually</>}
            </div>
          )}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl mb-5 text-sm font-semibold text-center">{error}</div>}

        {/* Methods */}
        <h3 className="text-white font-black text-lg mb-4">Select Payment Method</h3>
        <div className="space-y-3">
          {methods.map((method) => (
            <button
              key={method.id}
              disabled={processing}
              onClick={() => setSelectedMethod(method.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                selectedMethod === method.id
                  ? "bg-orange-500/10 border-orange-500"
                  : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
              } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                selectedMethod === method.id ? "bg-orange-500 shadow-lg shadow-orange-500/30" : "bg-neutral-800"
              }`}>
                {method.icon}
              </div>
              
              <div className="flex-1 text-left">
                <p className="text-white font-bold text-base">{method.name}</p>
                <p className={`text-xs ${selectedMethod === method.id ? "text-orange-400" : "text-neutral-500"}`}>
                  {method.desc}
                </p>
              </div>

              {/* Radio check */}
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                selectedMethod === method.id ? "border-orange-500" : "border-neutral-600"
              }`}>
                {selectedMethod === method.id && <div className="w-3 h-3 bg-orange-500 rounded-full" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pay Button Sticky Bottom */}
      <div className="px-5 pb-5 pt-3 bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent">
        <button
          onClick={handlePay}
          disabled={processing || !selectedMethod}
          className="w-full bg-orange-500 hover:bg-orange-400 active:scale-[0.98] disabled:bg-neutral-800 disabled:text-neutral-500 disabled:scale-100 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2"
        >
          {processing ? (
             <>
               <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
               Processing...
             </>
          ) : (
             <>Securely Pay ₹{total}</>
          )}
        </button>
      </div>

      {/* Razorpay Mock Widget Overlay */}
      {showRazorpay && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            {/* Razorpay Header */}
            <div className="bg-[#02042b] p-4 flex justify-between items-center text-white">
              <div className="flex flex-col">
                <span className="font-bold text-sm">FoodReels Pvt Ltd</span>
                <span className="text-[10px] text-white/50 tracking-wider font-mono">ID: {razorpayOrder.order.id}</span>
              </div>
              <span className="font-extrabold text-lg">₹{total}</span>
            </div>
            
            {/* Razorpay Body */}
            <div className="p-6 flex flex-col items-center">
              <div className="w-16 h-16 bg-[#3395ff]/10 text-[#3395ff] rounded-full flex items-center justify-center text-3xl mb-4 shadow-inner">
                {selectedMethod === "upi" ? "📱" : "💳"}
              </div>
              <h3 className="text-neutral-800 font-bold text-lg mb-1">Razorpay Test Mode</h3>
              <p className="text-neutral-500 text-xs text-center mb-6 leading-relaxed">
                This simulated Razorpay widget passed standard order data to your MERN backend. Simulate a successful response to trigger cryptographic signature verification mapping.
              </p>
              
              <button 
                onClick={handleMockRazorpaySuccess}
                className="w-full bg-[#3395ff] hover:bg-[#2081ea] text-white py-3.5 rounded text-sm font-bold shadow-md transition-colors"
              >
                Simulate Successful Payment
              </button>
              <button 
                onClick={() => {
                  setShowRazorpay(false);
                  setProcessing(false);
                }}
                className="w-full bg-white text-red-500 py-3 rounded text-sm font-bold mt-1 hover:bg-neutral-50 transition-colors"
              >
                Cancel Transaction
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
