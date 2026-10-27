import { Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAdminStatus } from "../lib/useAdminStatus";

const NotFoundPage = lazy(() => import("../Pages/404"));

// Not signed in  -> /login
// Signed in, but NOT the admin email (server-verified) -> a normal-looking 404 page
export default function ProtectedRoute({ children }) {
  const { loading, authenticated, isAdmin, error } = useAdminStatus();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400" role="status">Loading...</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    if (error) console.warn("[admin] could not verify admin status:", error);
    return <Suspense fallback={null}><NotFoundPage /></Suspense>;
  }
  return children;
}
