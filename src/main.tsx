import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const AdminApp = lazy(() => import("./admin/AdminApp"));
if (window.location.pathname === "/auth/callback") {
  const destination = sessionStorage.getItem("poydem_after_oauth") || "/";
  sessionStorage.removeItem("poydem_after_oauth");
  window.history.replaceState(null, "", destination);
}
const isAdminPath = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
if (isAdminPath && !window.location.hash) window.history.replaceState(null, "", `${window.location.pathname}#/`);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminPath
      ? <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f5f7f2] font-bold text-[#102318]">Загружаем админ-панель…</div>}><AdminApp /></Suspense>
      : <App />}
  </React.StrictMode>,
);
