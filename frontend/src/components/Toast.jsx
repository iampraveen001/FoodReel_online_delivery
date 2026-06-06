export default function Toast({ msg, show }) {
  return (
    <div
      className={`absolute top-5 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 pointer-events-none ${
        show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      {msg}
    </div>
  );
}
