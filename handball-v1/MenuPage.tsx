@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  h1,h2,h3,h4 { font-family: 'DM Sans', system-ui, sans-serif; }
  * { box-sizing: border-box; }
}

@layer utilities {
  .line-clamp-1 { overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1; }
  .line-clamp-2 { overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2; }
  .line-clamp-3 { overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3; }
}

@keyframes slideUp {
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes fadeIn {
  from { opacity:0; }
  to   { opacity:1; }
}

.animate-slide-up { animation: slideUp 0.2s ease-out; }
.animate-fade-in  { animation: fadeIn  0.15s ease-out; }

::-webkit-scrollbar       { width:5px; height:5px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:4px; }
