import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { PropertyPage } from "./pages/PropertyPage.tsx";
import { ComparePage } from "./pages/ComparePage.tsx";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg w-7 h-7" />
              <span className="text-xl font-bold tracking-tight text-slate-900">
                STR Profitability Calculator
              </span>
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/property/:id" element={<PropertyPage />} />
            <Route path="/compare" element={<ComparePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
