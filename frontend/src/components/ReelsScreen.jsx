import { useState, useRef, useEffect, useCallback } from "react";
import { foods as mockFoods } from "../data/foods";
import ReelCard from "./ReelCard";

export default function ReelsScreen({ onAddToast, user, token }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef();
  const pageRef = useRef(1);
  const containerRef = useRef();

  const fetchReels = useCallback(async (page = 1) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/food/reels?page=${page}&limit=10`);
      const data = await res.json();
      
      if (res.ok && data.data?.feed?.length > 0) {
        const mappedElements = data.data.feed.map(item => ({
          id: item._id,
          foodItemId: item._id,           // MongoDB _id for order API
          restaurantId: item.restaurant?._id || item.restaurant, // MongoDB restaurant _id
          name: item.name,
          desc: item.description || "Freshly cooked and incredibly delicious!",
          price: item.price,
          category: item.category || "Highlights",
          bg: "from-black/80 to-black",
          emoji: "🍽️",
          videoUrl: item.videoUrl,
          restaurant: item.restaurant?.name || "Kitchen",
          restEmoji: "👨‍🍳",
          rating: "4.9",
          reviews: "Just now",
          likes: item.likes || 0,
        }));
        
        setFeed(prev => page === 1 ? mappedElements : [...prev, ...mappedElements]);
        pageRef.current = page;
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load reels:", err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchReels(1);
  }, [fetchReels]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!containerRef.current) return;
      const scrollAmount = window.innerHeight; // Scroll by full screen height
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        containerRef.current.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        containerRef.current.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const lastReelRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchReels(pageRef.current + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, fetchReels]);

  const scrollUp = () => {
    containerRef.current?.scrollBy({ top: -window.innerHeight, behavior: "smooth" });
  };

  const scrollDown = () => {
    containerRef.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" });
  };

  return (
    <div className="flex-1 h-full min-h-screen relative">
      <div ref={containerRef} className="w-full h-full min-h-screen overflow-y-auto bg-black scroll-smooth">
        {feed.length === 0 && loading ? (
          <div className="flex items-center justify-center h-full text-white">
            Loading reels...
          </div>
        ) : (
          feed.map((food, i) => (
            <div
              key={food.id}
              ref={i === feed.length - 1 ? lastReelRef : null}
              className="w-full h-screen relative"
            >
              <ReelCard 
                food={food} 
                onAdd={onAddToast} 
                user={user} 
                token={token}
                isCurrent={true}
              />
            </div>
          ))
        )}
        {loading && feed.length > 0 && (
          <div className="flex items-center justify-center h-20 text-white">
            Loading more...
          </div>
        )}
      </div>

      {/* Arrow Navigation Buttons */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50 pointer-events-none" style={{ left: "50%", transform: "translateX(-50%) translateY(-50%)" }}>
      </div>

      {/* Up Arrow */}
      <button
        onClick={scrollUp}
        className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
        style={{
          top: "18px",
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          border: "1.5px solid rgba(255,255,255,0.18)",
          boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
          cursor: "pointer",
          transition: "background 0.2s, transform 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,120,0,0.55)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.45)"}
        onMouseDown={e => e.currentTarget.style.transform = "translateX(-50%) scale(0.92)"}
        onMouseUp={e => e.currentTarget.style.transform = "translateX(-50%) scale(1)"}
        title="Previous reel"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {/* Down Arrow */}
      <button
        onClick={scrollDown}
        className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
        style={{
          bottom: "88px",
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          border: "1.5px solid rgba(255,255,255,0.18)",
          boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
          cursor: "pointer",
          transition: "background 0.2s, transform 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,120,0,0.55)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.45)"}
        onMouseDown={e => e.currentTarget.style.transform = "translateX(-50%) scale(0.92)"}
        onMouseUp={e => e.currentTarget.style.transform = "translateX(-50%) scale(1)"}
        title="Next reel"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}
