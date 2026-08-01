import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

client.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("angel_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Auto-redirect to admin login when the JWT is missing/expired on any protected call
client.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";
    const isAdminCall =
      url.startsWith("/admin") ||
      ["/categories", "/products", "/addon-groups", "/settings", "/schedule", "/promos"].some(
        (p) => url.startsWith(p) && err?.config?.method && err.config.method.toLowerCase() !== "get"
      );
    if ((status === 401 || status === 403) && isAdminCall && typeof window !== "undefined") {
      const onAdmin = window.location.pathname.startsWith("/Angel");
      if (onAdmin && !window.location.pathname.endsWith("/login")) {
        localStorage.removeItem("angel_token");
        window.location.href = "/Angel/login?expired=1";
      }
    }
    return Promise.reject(err);
  }
);

export default client;

export const mediaUrl = (u) => {
  if (!u) return "";
  if (u.startsWith("http")) return u;
  return `${BACKEND_URL}${u}`;
};

export const CHF = (v) => `CHF ${(Number(v) || 0).toFixed(2)}`;
