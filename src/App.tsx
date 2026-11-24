import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Roles } from './pages/Roles';
import { Users } from './pages/Users';
import { AuditLogs } from './pages/AuditLogs';
import { ModulePlaceholder } from './pages/ModulePlaceholder';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/products" element={<ModulePlaceholder />} />
                    <Route path="/categories" element={<ModulePlaceholder />} />
                    <Route path="/suppliers" element={<ModulePlaceholder />} />
                    <Route path="/stock-in" element={<ModulePlaceholder />} />
                    <Route path="/stock-out" element={<ModulePlaceholder />} />
                    <Route path="/warehouse-stock" element={<ModulePlaceholder />} />
                    <Route path="/kitchen-requests" element={<ModulePlaceholder />} />
                    <Route path="/deliveries" element={<ModulePlaceholder />} />
                    <Route path="/drivers" element={<ModulePlaceholder />} />
                    <Route path="/reports" element={<ModulePlaceholder />} />
                    <Route 
                      path="/users" 
                      element={
                        <ProtectedRoute requiredPermission="users.view">
                          <Users />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/roles" 
                      element={
                        <ProtectedRoute requiredPermission="roles.view">
                          <Roles />
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="/settings" element={<ModulePlaceholder />} />
                    <Route 
                      path="/audit-logs" 
                      element={
                        <ProtectedRoute requiredPermission="users.view">
                          <AuditLogs />
                        </ProtectedRoute>
                      } 
                    />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
