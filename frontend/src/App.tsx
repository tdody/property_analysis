import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { PropertyPage } from "./pages/PropertyPage.tsx";
import { ComparePage } from "./pages/ComparePage.tsx";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Link to="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              STR Profitability Calculator
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
