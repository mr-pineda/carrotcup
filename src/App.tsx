import { HashRouter, Routes, Route } from "react-router";
import { Home } from "./Home";
import { Admin } from "./Admin";
import { Login } from "./Login";
import "./index.css";

export function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-[#0a0a0f] text-white selection:bg-purple-500/30 overflow-hidden relative">
        {/* Abstract Background Elements */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen"></div>
          <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] mix-blend-screen"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-pink-600/10 rounded-full blur-[150px] mix-blend-screen"></div>
        </div>

        {/* Navbar */}
        <nav className="relative z-50 border-b border-white/5 bg-black/20 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
            <a href="#/" className="text-xl font-bold font-['Outfit'] tracking-wide flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center group-hover:shadow-[0_0_15px_rgba(249,115,22,0.5)] transition-shadow">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span>Copa <span className="text-orange-400">Zanahoria</span></span>
            </a>
            
            <a 
              href="#/admin" 
              className="text-sm font-medium text-white/60 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/5"
            >
              Administrar
            </a>
          </div>
        </nav>

        {/* Main Content */}
        <main className="relative z-10 min-h-[calc(100vh-4rem)]">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
