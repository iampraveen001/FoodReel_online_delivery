import { useState, useRef, useEffect } from "react";
import { useCart } from "../hooks/useCart";

const STORAGE_KEY = "foodreels_liked_reels";

const getStoredLikes = () => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const storeLikes = (likes) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(likes));
};

export default function ReelCard({ food, onAdd, user, isCurrent, token }) {
  const [liked, setLiked] = useState(() => {
    const storedLikes = getStoredLikes();
    return food.likedBy?.includes(user?._id) || storedLikes.includes(String(food.id));
  });
  const [likes, setLikes] = useState(food.likes);
  const [likeAnim, setLikeAnim] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [tapCount, setTapCount] = useState(0);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const videoRef = useRef(null);
  const tapTimeoutRef = useRef(null);
  const { addToCart } = useCart();

  const handleLike = async () => {
    if (!user) {
      onAdd("Please login to like reels!");
      return;
    }

    if (!token) {
      onAdd("Authentication token missing. Please login again.");
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/food/${food.id}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLiked(data.liked);
        setLikes(data.likes);
        const storedLikes = getStoredLikes();
        const itemId = String(food.id);

        if (data.liked) {
          setLikeAnim(true);
          setTimeout(() => setLikeAnim(false), 300);
          if (!storedLikes.includes(itemId)) {
            storeLikes([...storedLikes, itemId]);
          }
        } else {
          storeLikes(storedLikes.filter((id) => id !== itemId));
        }
      } else {
        onAdd("Failed to like reel");
      }
    } catch (error) {
      console.error('Like error:', error);
      onAdd("Network error");
    }
  };

  const handleAdd = () => {
    addToCart(food);
    onAdd(food.name);
  };

  const handleDoubleTap = () => {
    if (!liked) {
      handleLike();
      setDoubleTapHeart(true);
      setTimeout(() => setDoubleTapHeart(false), 800);
    }
  };

  const handleTap = () => {
    setTapCount(prev => prev + 1);
    
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    
    tapTimeoutRef.current = setTimeout(() => {
      if (tapCount >= 1) {
        // Single tap - could be used for play/pause in future
        setTapCount(0);
      }
    }, 300);
    
    if (tapCount === 1) {
      handleDoubleTap();
      setTapCount(0);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {
          // Handle autoplay restrictions
        });
        setIsPlaying(true);
      }
    }
  };

  const toggleSound = () => {
    setSoundOn((prev) => !prev);
  };

  useEffect(() => {
    if (videoRef.current) {
      if (isCurrent) {
        videoRef.current.play().catch(() => {
          // Handle autoplay restrictions
        });
        setIsPlaying(true);
        setSoundOn(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }

      videoRef.current.muted = !isCurrent || !soundOn;
      videoRef.current.volume = soundOn && isCurrent ? 0.75 : 0;
    }
  }, [isCurrent, soundOn]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div className={`absolute inset-0 w-full h-full bg-gradient-to-b ${food.bg} flex flex-col`}>
      {/* Food Visual */}
      {food.videoUrl ? (
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full max-w-[420px] aspect-[9/16] overflow-hidden rounded-3xl">
              <video 
                ref={videoRef}
                src={`${import.meta.env.VITE_API_URL}/${food.videoUrl.replace(/\\/g, '/')}`} 
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay 
                loop
                muted={!isCurrent}
                playsInline
                onClick={handleTap}
              />
            </div>
          </div>
          
          {/* Play/Pause Overlay */}
          {!isPlaying && isCurrent && (
            <div className="absolute inset-0 flex items-center justify-center z-15">
              <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center">
                <div className="w-0 h-0 border-l-4 border-l-white border-t-2 border-t-transparent border-b-2 border-b-transparent ml-1"></div>
              </div>
            </div>
          )}
          
          {/* Double Tap Heart Animation */}
          {doubleTapHeart && (
            <div className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none">
              <div className="text-6xl animate-ping">❤️</div>
            </div>
          )}
        </>
      ) : (
        <div 
          className="absolute inset-0 flex items-center justify-center text-[120px] select-none"
          onClick={handleTap}
        >
          {food.emoji || "🍽️"}
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

      {/* Right Actions */}
      <div className="absolute right-3 bottom-32 flex flex-col gap-5 z-10 items-center">
        {/* Account Avatar + Follow */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center text-base">
            {food.restEmoji}
          </div>
          <button className="text-[10px] text-orange-400 border border-orange-400 rounded-full px-2 py-0.5 mt-0.5 leading-tight">
            Follow
          </button>
        </div>

        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <div
            className={`w-11 h-11 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-xl transition-transform ${
              likeAnim ? "scale-125" : "scale-100"
            }`}
          >
            {liked ? "❤️" : "🤍"}
          </div>
          <span className="text-[10px] text-white/70">{likes}</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-xl">
            💬
          </div>
          <span className="text-[10px] text-white/70">
            {Math.floor(Math.random() * 200 + 50)}
          </span>
        </button>

        <button onClick={toggleSound} className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-xl">
            {soundOn && isCurrent ? "🔊" : "🔇"}
          </div>
          <span className="text-[10px] text-white/70">{soundOn && isCurrent ? "Sound" : "Mute"}</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-xl">
            📤
          </div>
          <span className="text-[10px] text-white/70">Share</span>
        </button>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-20">
        {/* Restaurant Row */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-bold text-white text-sm" style={{ fontFamily: "system-ui" }}>
            {food.restaurant}
          </span>
        </div>

        {/* Food Name */}
        <h2 className="text-white text-2xl font-black leading-tight">{food.name}</h2>
        <p className="text-white/60 text-xs mt-1">{food.desc}</p>

        {/* Price Row */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-orange-400 text-xl font-black">₹{food.price}</span>
          <span className="text-yellow-400 text-xs">
            ⭐ {food.rating} ({food.reviews})
          </span>
          {(!user || user.role === "customer") && (
            <button
              onClick={handleAdd}
              className="ml-auto bg-orange-500 hover:bg-orange-400 active:scale-95 text-white py-3 px-2 rounded-full text-sm font-bold transition-all"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {/* Category tag */}
      <div className="absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-sm text-white/80 text-xs px-3 py-1 rounded-full">
        {food.category}
      </div>
    </div>
  );
}
