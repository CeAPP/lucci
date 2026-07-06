import { Link, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_pizzeria-app-26/artifacts/jwci5np5_LOgo%20angelucci.png";

const NAV = [
  { to: "/commander", label: "Commander" },
  { to: "/epicerie", label: "Épicerie" },
  { to: "/reserver", label: "Réserver" },
  { to: "/histoire", label: "Notre histoire" },
  { to: "/contact", label: "Contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <header
      data-testid="site-header"
      className="fixed top-0 left-0 right-0 z-50 bg-cream/95 backdrop-blur-xl border-b border-ink/10"
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between h-20">
        <Link to="/" data-testid="header-logo" className="flex items-center gap-3 group">
          <img src={LOGO} alt="Angelucci's" className="h-14 w-14 object-contain" />
          <span className="hidden sm:block font-display text-2xl tracking-[.2em] text-ink group-hover:text-brand transition-colors">
            ANGELUCCI'S
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-9">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`nav-${n.to.replace("/", "")}`}
              className={({ isActive }) =>
                `text-[13px] tracking-[.15em] uppercase link-underline transition-colors ${
                  isActive ? "text-brand" : "text-ink hover:text-brand"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <button
          data-testid="mobile-menu-btn"
          className="lg:hidden text-ink"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X size={26} strokeWidth={1.5} /> : <Menu size={26} strokeWidth={1.5} />}
        </button>
      </div>

      {open && (
        <div data-testid="mobile-menu" className="lg:hidden bg-cream border-t border-ink/10">
          <div className="flex flex-col p-6 gap-5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={`mnav-${n.to.replace("/", "")}`}
                className={({ isActive }) =>
                  `text-lg font-display tracking-wide ${isActive ? "text-brand" : "text-ink"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
