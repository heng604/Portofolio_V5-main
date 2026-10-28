import { Navigate, Route, Routes } from "react-router-dom";
import { useAdminStatus } from "./lib/useAdminStatus";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Content from "./pages/Content";
import Appearance from "./pages/Appearance";
import Payments from "./pages/Payments";

// Every private page sits behind this gate. It is only UX: the real enforcement is the database (is_admin() in RLS)
// and the API (verified Supabase JWT + ADMIN_EMAIL), so skipping this component would still expose nothing.
function Gate({ children }) {
  const { loading, authenticated, isAdmin } = useAdminStatus();
  if (loading) return <div role="status" className="min-h-screen grid place-items-center text-gray-400">Loading...</div>;
  if (!authenticated || !isAdmin) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Gate><Layout /></Gate>}>
        <Route index element={<Overview />} />
        <Route path="content/*" element={<Content />} />
        <Route path="appearance" element={<Appearance />} />
        <Route path="payments" element={<Payments />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
