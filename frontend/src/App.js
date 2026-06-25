import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import TicketsList from "@/pages/TicketsList";
import TicketDetail from "@/pages/TicketDetail";
import CreateTicket from "@/pages/CreateTicket";
import MasterData from "@/pages/MasterData";
import Reports from "@/pages/Reports";
import ChangePassword from "@/pages/ChangePassword";
import Executive from "@/pages/Executive";
import KnowledgeBase from "@/pages/KnowledgeBase";
import KnowledgeArticle from "@/pages/KnowledgeArticle";
import AuditLog from "@/pages/AuditLog";
import { Toaster } from "sonner";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tickets" element={<TicketsList />} />
            <Route path="/tickets/new" element={<CreateTicket />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/kb" element={<KnowledgeBase />} />
            <Route path="/kb/new" element={<ProtectedRoute roles={["koordinator"]}><KnowledgeArticle mode="new" /></ProtectedRoute>} />
            <Route path="/kb/:id" element={<KnowledgeArticle mode="view" />} />
            <Route path="/kb/:id/edit" element={<ProtectedRoute roles={["koordinator"]}><KnowledgeArticle mode="edit" /></ProtectedRoute>} />
            <Route path="/master" element={<ProtectedRoute roles={["koordinator"]}><MasterData /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={["koordinator"]}><Reports /></ProtectedRoute>} />
            <Route path="/executive" element={<ProtectedRoute roles={["koordinator"]}><Executive /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute roles={["koordinator"]}><AuditLog /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
