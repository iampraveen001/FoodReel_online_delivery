import { useState, useEffect } from "react";
import { useCart } from "../hooks/useCart";

/* ─── DATA ──────────────────────────────────────────────── */
const categories = [
  { id: 1, label: "Pizza",    img: "https://cdn-icons-png.flaticon.com/128/3132/3132693.png" },
  { id: 2, label: "Burgers",  img: "https://cdn-icons-png.flaticon.com/128/1825/1825460.png" },
  { id: 3, label: "Sushi",    img: "https://cdn-icons-png.flaticon.com/128/2252/2252075.png" },
  { id: 4, label: "Tacos",    img: "https://cdn-icons-png.flaticon.com/128/2771/2771388.png" },
  { id: 5, label: "Noodles",  img: "https://cdn-icons-png.flaticon.com/128/2771/2771406.png" },
  { id: 6, label: "Salads",   img: "https://cdn-icons-png.flaticon.com/128/2515/2515263.png" },
  { id: 7, label: "Desserts", img: "https://cdn-icons-png.flaticon.com/128/3081/3081986.png" },
  { id: 8, label: "Drinks",   img: "https://cdn-icons-png.flaticon.com/128/2738/2738749.png" },
];

/* ─── INLINE SVG ICONS ───────────────────────────────────── */
const IcoHome    = ({ a }) => <svg width="22" height="22" viewBox="0 0 24 24" fill={a?"#FF6B35":"none"} stroke={a?"#FF6B35":"#A0917F"} strokeWidth="1.8"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
const IcoSearch  = ({ a }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"#FF6B35":"#A0917F"} strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>;
const IcoOrders  = ({ a }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"#FF6B35":"#A0917F"} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M8 8h5M8 16h6"/></svg>;
const IcoProfile = ({ a }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"#FF6B35":"#A0917F"} strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
const IcoCart    = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>;
const IcoPin     = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF6B35"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>;
const IcoBell    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1208" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>;
const IcoStar    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="#FBBF24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
const IcoClock   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#A0917F" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
const IcoPlus    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>;
const IcoCheck   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M5 12l5 5L20 7"/></svg>;
const IcoFilter  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4"/></svg>;
const IcoChevron = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>;

/* ─── MAIN COMPONENT ─────────────────────────────────────── */
export default function FoodAppHome({ onSetScreen }) {
  const [activeCat, setActiveCat] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vis, setVis] = useState(false);
  const { addToCart, totalItems } = useCart();

  useEffect(() => {
    requestAnimationFrame(() => setVis(true));
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch featured food items
      const foodRes = await fetch(`${import.meta.env.VITE_API_URL}/api/food?limit=4&sort=-likes`);
      const foodData = await foodRes.json();
      
      if (foodData.success) {
        const featuredItems = foodData.data.map(item => ({
          id: item._id,
          foodItemId: item._id,                                  // needed for order API
          restaurantId: item.restaurant?._id || item.restaurant, // needed for order API
          name: item.name,
          restaurant: item.restaurant?.name || 'Unknown Restaurant',
          price: item.price,
          rating: item.restaurant?.avgRating || 4.5,
          time: "25–35",
          tag: item.tags?.includes('bestseller') ? "Popular" : "Featured",
          tagBg: item.tags?.includes('bestseller') ? "#FF6B35" : "#3B82F6",
          cardBg: item.tags?.includes('bestseller') ? "#FFF0E8" : "#EAF4FF",
          img: item.thumbnailUrl || "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&q=80",
          isVeg: item.isVeg,
          description: item.description
        }));
        setFeatured(featuredItems);
      }

      // Fetch nearby restaurants
      const restRes = await fetch(`${import.meta.env.VITE_API_URL}/api/restaurants?limit=4`);
      const restData = await restRes.json();
      
      if (restData.success) {
        const nearbyRestaurants = restData.data.map(rest => ({
          id: rest._id,
          name: rest.name,
          cuisine: rest.cuisine?.join(' · ') || 'Multi Cuisine',
          rating: rest.avgRating || 4.5,
          distance: "1.2 km", // This would need geolocation in real app
          time: "25 min",
          promo: rest.minOrderAmount ? `Min ₹${rest.minOrderAmount}` : null,
          img: rest.logo || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120&q=80",
        }));
        setNearby(nearbyRestaurants);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Fallback to static data if API fails
      setFeatured([
        {
          id: 1,
          name: "Wood-Fired Pizza",
          restaurant: "Milano Kitchen",
          price: 349,
          rating: 4.9,
          time: "25–35",
          tag: "Popular",
          tagBg: "#FF6B35",
          cardBg: "#FFF0E8",
          img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=300&q=80",
        },
        {
          id: 2,
          name: "Dal Makhani Thali",
          restaurant: "Punjabi Tadka",
          price: 189,
          rating: 4.8,
          time: "30–40",
          tag: "Top Rated",
          tagBg: "#3B82F6",
          cardBg: "#EAF4FF",
          img: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&q=80",
        },
      ]);
      setNearby([
        {
          id: 1,
          name: "Milano Kitchen",
          cuisine: "Italian · Pizza",
          rating: 4.6,
          distance: "0.8 km",
          time: "20 min",
          promo: "20% off",
          img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120&q=80",
        },
        {
          id: 2,
          name: "Punjabi Tadka",
          cuisine: "Indian · Curries",
          rating: 4.8,
          distance: "1.2 km",
          time: "25 min",
          promo: null,
          img: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=120&q=80",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (item) => {
    addToCart({
      id: item.id,
      foodItemId: item.foodItemId || item.id,   // required for order placement
      restaurantId: item.restaurantId,           // required for order placement
      name: item.name,
      price: item.price,
      restaurant: item.restaurant,
      img: item.img
    });
  };

  const fd = (d) => ({
    opacity: vis ? 1 : 0,
    transform: vis ? "none" : "translateY(18px)",
    transition: `opacity 0.4s ease ${d}s, transform 0.4s ease ${d}s`,
  });

  return (
    <>
      <style>{`
        .fah-logo{font-family:'Syne',sans-serif;font-size:24px;font-weight:100;color:#FF6B35;letter-spacing:-1px;}
        .fah-logo span{color:#1A1208;}
        .fah-loc{display:flex;flex-direction:column;align-items:center;gap:1px;}
        .fah-loc-lbl{font-size:10px;font-weight:100;letter-spacing:1px;text-transform:uppercase;color:#B09880;}
        .fah-loc-addr{display:flex;align-items:center;gap:4px;font-size:13px;font-weight:100;color:#1A1208;}
        .fah-nav-r{display:flex;align-items:center;gap:10px;}
        .fah-icon-btn{background:none;border:none;cursor:pointer;padding:6px;border-radius:10px;display:flex;align-items:center;justify-content:center;}
        .fah-icon-btn:active{background:rgba(0,0,0,0.06);}
        .fah-cart-btn{background:#1A1208;border:none;cursor:pointer;border-radius:12px;padding:8px 14px;display:flex;align-items:center;gap:6px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:100;color:#fff;position:relative;transition:transform .1s;}
        .fah-cart-btn:active{transform:scale(.95);}
        .fah-badge{position:absolute;top:-7px;right:-7px;background:#FF6B35;color:#fff;font-size:10px;font-weight:100;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #FFFAF5;}
        .fah-hero{margin:14px 20px;border-radius:24px;padding:28px 22px 24px;background:linear-gradient(130deg,#FF7340 0%,#FF9A6C 100%);position:relative;overflow:hidden;}
        .fah-hero-blob{position:absolute;top:-30px;right:-20px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.12);pointer-events:none;}
        .fah-hero-blob2{position:absolute;bottom:-40px;right:40px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,.08);pointer-events:none;}
        .fah-hero-img{position:absolute;right:16px;top:50%;transform:translateY(-50%);width:115px;height:115px;object-fit:cover;border-radius:18px;box-shadow:0 8px 20px rgba(0,0,0,.2);}
        .fah-hero-eye{font-size:10px;font-weight:100;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.8);margin-bottom:8px;}
        .fah-hero-h1{font-family:'Syne',sans-serif;font-size:25px;font-weight:100;color:#fff;line-height:1.2;margin-bottom:18px;max-width:185px;}
        .fah-hero-btn{background:#fff;color:#FF6B35;border:none;border-radius:12px;padding:11px 20px;font-family:'DM Sans',sans-serif;font-weight:100;font-size:13px;cursor:pointer;transition:transform .1s;box-shadow:0 4px 14px rgba(0,0,0,.15);display:inline-flex;align-items:center;gap:6px;}
        .fah-hero-btn:active{transform:scale(.96);}
        .fah-search{margin:14px 20px;display:flex;gap:10px;}
        .fah-search-wrap{flex:1;position:relative;}
        .fah-search-ic{position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none;}
        .fah-search-in{width:100%;background:#fff;border:1.5px solid #EDE3D8;border-radius:14px;padding:13px 14px 13px 42px;font-family:'DM Sans',sans-serif;font-size:14px;color:#1A1208;outline:none;transition:border-color .15s,box-shadow .15s;}
        .fah-search-in::placeholder{color:#B09880;}
        .fah-search-in:focus{border-color:#FF6B35;box-shadow:0 0 0 3px rgba(255,107,53,.12);}
        .fah-filter-btn{background:#1A1208;border:none;border-radius:14px;width:50px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .1s;}
        .fah-filter-btn:active{transform:scale(.94);}
        .fah-sec-hdr{display:flex;justify-content:space-between;align-items:center;padding:18px 20px 10px;}
        .fah-sec-title{font-family:'Syne',sans-serif;font-size:19px;font-weight:100;color:#1A1208;}
        .fah-see-all{background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:100;color:#FF6B35;display:flex;align-items:center;gap:2px;}
        .fah-cats{display:flex;gap:10px;overflow-x:auto;padding:0 20px 6px;}
        .fah-cat{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 10px 10px;border-radius:16px;border:1.5px solid #EDE3D8;background:#fff;cursor:pointer;min-width:68px;flex-shrink:0;transition:all .15s ease;}
        .fah-cat.act{border-color:#FF6B35;background:#FFF0E8;}
        .fah-cat:active{transform:scale(.94);}
        .fah-cat img{width:36px;height:36px;object-fit:contain;}
        .fah-cat-lbl{font-size:11px;font-weight:100;color:#7A6555;white-space:nowrap;letter-spacing:.2px;}
        .fah-cat.act .fah-cat-lbl{color:#FF6B35;}
        .fah-featured{display:flex;gap:14px;overflow-x:auto;padding:0 20px 10px;}
        .fah-fcard{border-radius:20px;padding:14px 13px 13px;min-width:182px;max-width:182px;flex-shrink:0;cursor:pointer;position:relative;overflow:hidden;transition:transform .15s;}
        .fah-fcard:active{transform:scale(.97);}
        .fah-fcard-img{width:100%;height:110px;object-fit:cover;border-radius:14px;margin-bottom:10px;display:block;}
        .fah-fcard-tag{display:inline-block;border-radius:8px;padding:4px 9px;font-size:10px;font-weight:100;letter-spacing:.4px;color:#fff;margin-bottom:7px;}
        .fah-fcard-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:100;color:#1A1208;line-height:1.25;margin-bottom:3px;}
        .fah-fcard-rest{font-size:12px;color:#8A7565;margin-bottom:40px;}
        .fah-fcard-foot{display:flex;align-items:center;justify-content:space-between;}
        .fah-fcard-price{font-family:'Syne',sans-serif;font-size:16px;font-weight:100;color:#FF6B35;}
        .fah-fcard-stats{display:flex;flex-direction:column;align-items:flex-end;gap:3px;}
        .fah-fcard-rating{display:flex;align-items:center;gap:3px;font-size:11px;font-weight:100;color:#1A1208;}
        .fah-fcard-time{display:flex;align-items:center;gap:3px;font-size:10px;color:#8A7565;}
        .fah-add-btn{position:absolute;top:14px;left:14px;width:34px;height:34px;border-radius:12px;background:#FF6B35;color:#fff;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,transform .15s,box-shadow .15s;box-shadow:0 8px 18px rgba(255,107,53,.28);}
        .fah-add-btn:hover{transform:translateY(-2px);background:#ff7d4b;box-shadow:0 10px 22px rgba(255,107,53,.32);}
        .fah-add-btn:active{transform:scale(.92);}
        .fah-nearby{padding:0 20px;display:flex;flex-direction:column;gap:10px;}
        .fah-rcard{background:#fff;border-radius:18px;border:1.5px solid #EDE3D8;padding:12px 14px;display:flex;align-items:center;gap:13px;cursor:pointer;transition:transform .1s,box-shadow .15s;}
        .fah-rcard:active{transform:scale(.98);box-shadow:0 4px 16px rgba(0,0,0,.08);}
        .fah-rcard-img{width:58px;height:58px;border-radius:14px;object-fit:cover;flex-shrink:0;}
        .fah-rcard-info{flex:1;min-width:0;}
        .fah-rcard-name{font-family:'Syne',sans-serif;font-size:15px;font-weight:100;color:#1A1208;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fah-rcard-cuisine{font-size:12px;color:#8A7565;margin-bottom:5px;}
        .fah-rcard-meta{display:flex;align-items:center;gap:6px;}
        .fah-rcard-rating{display:flex;align-items:center;gap:3px;font-size:12px;font-weight:100;color:#1A1208;}
        .fah-rcard-dot{width:3px;height:3px;border-radius:50%;background:#C8B8A8;}
        .fah-rcard-stat{font-size:12px;color:#8A7565;}
        .fah-promo{font-size:10px;font-weight:100;background:#FFF0E8;color:#FF6B35;border-radius:6px;padding:3px 8px;white-space:nowrap;margin-left:auto;flex-shrink:0;}
        .fah-bottomnav{position:sticky;bottom:0;background:#fff;border-top:1.5px solid #EDE3D8;display:flex;justify-content:space-around;padding:10px 20px 18px;}
        .fah-navitem{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;background:none;border:none;padding:4px 10px;border-radius:12px;transition:background .12s;}
        .fah-navitem:active{background:rgba(255,107,53,.08);}
        .fah-navlbl{font-size:10px;font-weight:100;letter-spacing:.3px;}
      `}</style>

      <div className="fah">
        {/* ── Hero ── */}
        <div className="fah-hero" style={fd(0.05)}>
          <div className="fah-hero-blob" />
          <div className="fah-hero-blob2" />
          <img className="fah-hero-img" src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=220&q=80" alt="" />
          <p className="fah-hero-eye">FoodReels Experience</p>
          <h1 className="fah-hero-h1">Watch, Order & Enjoy Fresh Food</h1>
          <button className="fah-hero-btn" onClick={() => onSetScreen('reels')}>Explore Reels 🍽️</button>
        </div>

        {/* ── Search ── */}
        <div className="fah-search" style={fd(0.12)}>
          <div className="fah-search-wrap">
            <span className="fah-search-ic">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B09880" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
            </span>
            <input className="fah-search-in" placeholder="Search dishes or restaurants…" />
          </div>
          <button className="fah-filter-btn" aria-label="Filters"><IcoFilter /></button>
        </div>

        {/* ── Categories ── */}
        <div style={fd(0.20)}>
          <div className="fah-sec-hdr">
            <span className="fah-sec-title">Categories</span>
          </div>
          <div className="fah-cats">
            {categories.map((c) => (
              <div
                key={c.id}
                className={`fah-cat${activeCat === c.id ? " act" : ""}`}
                onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}
                role="button" tabIndex={0}
              >
                <img src={c.img} alt={c.label} />
                <span className="fah-cat-lbl">{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Featured ── */}
        <div style={fd(0.28)}>
          <div className="fah-sec-hdr">
            <span className="fah-sec-title">Featured Dishes</span>
            <button className="fah-see-all">See all <IcoChevron /></button>
          </div>
          <div className="fah-featured">
            {loading ? (
              // Loading skeleton
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="fah-fcard" style={{ background: "#f5f5f5" }}>
                  <div className="fah-fcard-img" style={{ background: "#e0e0e0" }} />
                  <div style={{ height: "20px", background: "#e0e0e0", marginBottom: "8px", borderRadius: "4px" }} />
                  <div style={{ height: "16px", background: "#e0e0e0", marginBottom: "8px", borderRadius: "4px", width: "80%" }} />
                  <div style={{ height: "14px", background: "#e0e0e0", marginBottom: "20px", borderRadius: "4px", width: "60%" }} />
                </div>
              ))
            ) : (
              featured.map((item) => (
                <div key={item.id} className="fah-fcard" style={{ background: item.cardBg }}>
                  <img className="fah-fcard-img" src={item.img} alt={item.name} />
                  <span className="fah-fcard-tag" style={{ background: item.tagBg }}>{item.tag}</span>
                  <div className="fah-fcard-name">{item.name}</div>
                  <div className="fah-fcard-rest">{item.restaurant}</div>
                  <div className="fah-fcard-foot">
                    <span className="fah-fcard-price">₹{item.price}</span>
                    <div className="fah-fcard-stats">
                      <span className="fah-fcard-rating"><IcoStar /> {item.rating}</span>
                      <span className="fah-fcard-time"><IcoClock /> {item.time} min</span>
                    </div>
                  </div>
                  <button
                    className="fah-add-btn"
                    onClick={() => handleAddToCart(item)}
                    aria-label={`Add ${item.name}`}
                  >
                    <IcoPlus />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Nearby ── */}
        <div style={fd(0.36)}>
          <div className="fah-sec-hdr">
            <span className="fah-sec-title">Nearby Restaurants</span>
            <button className="fah-see-all">See all <IcoChevron /></button>
          </div>
          <div className="fah-nearby">
            {loading ? (
              // Loading skeleton for restaurants
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="fah-rcard" style={{ background: "#f5f5f5" }}>
                  <div style={{ width: "58px", height: "58px", borderRadius: "14px", background: "#e0e0e0", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ height: "16px", background: "#e0e0e0", marginBottom: "4px", borderRadius: "4px", width: "70%" }} />
                    <div style={{ height: "14px", background: "#e0e0e0", marginBottom: "8px", borderRadius: "4px", width: "50%" }} />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <div style={{ height: "12px", background: "#e0e0e0", borderRadius: "4px", width: "40px" }} />
                      <div style={{ height: "12px", background: "#e0e0e0", borderRadius: "4px", width: "30px" }} />
                      <div style={{ height: "12px", background: "#e0e0e0", borderRadius: "4px", width: "35px" }} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              nearby.map((r) => (
                <div key={r.id} className="fah-rcard">
                  <img className="fah-rcard-img" src={r.img} alt={r.name} />
                  <div className="fah-rcard-info">
                    <div className="fah-rcard-name">{r.name}</div>
                    <div className="fah-rcard-cuisine">{r.cuisine}</div>
                    <div className="fah-rcard-meta">
                      <span className="fah-rcard-rating"><IcoStar /> {r.rating}</span>
                      <span className="fah-rcard-dot" />
                      <span className="fah-rcard-stat">{r.distance}</span>
                      <span className="fah-rcard-dot" />
                      <span className="fah-rcard-stat">{r.time}</span>
                    </div>
                  </div>
                  {r.promo && <span className="fah-promo">{r.promo}</span>}
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ height: 20 }} />
      </div>
    </>
  );
}
