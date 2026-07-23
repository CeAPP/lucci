import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Landing from "@/pages/Landing";
import Menu from "@/pages/Menu";
import Reservation from "@/pages/Reservation";
import Story from "@/pages/Story";
import Contact from "@/pages/Contact";
import OrderTracking from "@/pages/OrderTracking";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import AdminDashboard, { AdminLogin } from "@/pages/Admin";
import { CartProvider } from "@/context/CartContext";
import { TEMP_MODE } from "@/config";
import "@/index.css";

function AppRoutes() {
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith("/Angel/");
  return (
    <>
      {!isAdmin && <Header />}
      <AnimatePresence mode="wait">
        <Routes location={loc} key={loc.pathname}>
          <Route path="/" element={<Landing />} />
          {TEMP_MODE ? (
            <>
              <Route path="/commander" element={<Menu menuType="restaurant" />} />
              <Route path="/epicerie" element={<Menu menuType="epicerie" />} />
              <Route path="/reserver" element={<Reservation />} />
              <Route path="/panier" element={<Cart />} />
              <Route path="/checkout/:menuType" element={<Checkout />} />
              <Route path="/suivi/:id" element={<OrderTracking />} />
              <Route path="/Angel/login" element={<AdminLogin />} />
              <Route path="/Angel/dashboard" element={<AdminDashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/commander" element={<Menu menuType="restaurant" />} />
              <Route path="/epicerie" element={<Menu menuType="epicerie" />} />
              <Route path="/reserver" element={<Reservation />} />
              <Route path="/histoire" element={<Story />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/suivi/:id" element={<OrderTracking />} />
              <Route path="/panier" element={<Cart />} />
              <Route path="/checkout/:menuType" element={<Checkout />} />
              <Route path="/Angel/login" element={<AdminLogin />} />
              <Route path="/Angel/dashboard" element={<AdminDashboard />} />
            </>
          )}
        </Routes>
      </AnimatePresence>
      {!isAdmin && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" richColors closeButton theme="light" />
      </BrowserRouter>
    </CartProvider>
  );
}
