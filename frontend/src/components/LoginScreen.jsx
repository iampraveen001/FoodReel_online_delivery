import { useState } from "react";
import logo from "../assets/logo.svg";

export default function LoginScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        if (!email || !password) return;
        const res = await fetch( `${import.meta.env.VITE_API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to login");

        onLogin(data.data.user, data.data.accessToken);
      } else {
        if (!name || !phone || !email || !password) return;

        const backendRole = role === "user" ? "customer" : role;

        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone, password, role: backendRole }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to register");

        onLogin(data.data.user, data.data.accessToken);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-20 pt-6">
      <div className="flex flex-col justify-center min-h-full">
      <div className="text-center mb-10">
        <img src={logo} alt="Find Your Food" className="w-24 h-24 mx-auto mb-6" />
        <h1 className="text-white text-3xl font-black mb-2">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h1>
        <p className="text-neutral-400 text-sm">
          {isLogin ? "Login to order and track food" : "Sign up to start ordering food"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl text-center">
            {error}
          </div>
        )}

        {!isLogin && (
          <>
            <div>
              <label className="block text-neutral-400 text-xs font-semibold mb-1 ml-1 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-orange-500 rounded-2xl px-4 py-3.5 text-white outline-none transition-colors"
                placeholder="Rahul Sharma"
                required={!isLogin}
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-xs font-semibold mb-1 ml-1 uppercase tracking-wider">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-orange-500 rounded-2xl px-4 py-3.5 text-white outline-none transition-colors"
                placeholder="9876543210"
                required={!isLogin}
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-xs font-semibold mb-1 ml-1 uppercase tracking-wider">
                Role
              </label>
              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-orange-500 rounded-2xl px-4 py-3.5 text-white outline-none transition-colors appearance-none"
                >
                  <option value="user">Hungry User 🍕</option>
                  <option value="owner">Restaurant Owner 👨‍🍳</option>
                  <option value="deliveryman">Deliveryman 🛵</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-neutral-500">
                  ▼
                </div>
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-neutral-400 text-xs font-semibold mb-1 ml-1 uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 focus:border-orange-500 rounded-2xl px-4 py-3.5 text-white outline-none transition-colors"
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-neutral-400 text-xs font-semibold mb-1 ml-1 uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 focus:border-orange-500 rounded-2xl px-4 py-3.5 text-white outline-none transition-colors"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 mt-4"
        >
          {loading ? "Please wait..." : (isLogin ? "Sign In" : "Sign Up")}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-neutral-500">
        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-orange-500 font-semibold ml-1"
        >
          {isLogin ? "Sign up" : "Sign in"}
        </button>
      </div>
      </div>
    </div>
  );
}
