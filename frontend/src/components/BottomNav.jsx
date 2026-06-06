import { useCart } from "../hooks/useCart";

const tabs = [
  { id: "home",    path: "/",       icon: "🏠", label: "Home"    },
  { id: "reels",   path: "/reels",  icon: "🍽️", label: "Reels"   },
  { id: "cart",    path: "/cart",   icon: "🛒", label: "Cart"    },
  { id: "track",   path: "/track",  icon: "📍", label: "Track"   },
  { id: "profile", path: "/profile",icon: "👤", label: "Profile" },
];

const ownerTabs = [
  { id: "home",       path: "/",          icon: "🏠", label: "Home"          },
  { id: "reels",      path: "/reels",     icon: "🍽️", label: "Reels"         },
  { id: "restaurant", path: "/owner",     icon: "🏪", label: "My Restaurant" },
  { id: "track",      path: "/track",     icon: "📍", label: "Track"         },
  { id: "profile",    path: "/profile",   icon: "👤", label: "Profile"       },
];

export default function BottomNav({ active, onChange, user }) {
  const { totalItems } = useCart();

  const availableTabs = user?.role === "deliveryman"
    ? tabs.filter((tab) => tab.id !== "reels")
    : user?.role === "owner"
    ? ownerTabs
    : tabs;

  return (
    <nav className="absolute bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 flex pb-3 pt-2 z-40 h-25">
      {availableTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.path)}
          className={`flex-1 flex flex-col items-center gap-1 transition-all duration-150 ease-out transform ${
            active === tab.id ? "opacity-100" : "opacity-40"
          } hover:opacity-100 hover:-translate-y-1 active:translate-y-0`}
        >
          <div className="relative">
            <span className="text-xl">{tab.icon}</span>
            {tab.id === "cart" && totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                {totalItems}
              </span>
            )}
          </div>
          <span
            className={`text-[10px] ${
              active === tab.id ? "text-orange-500" : "text-neutral-500"
            }`}
          >
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
