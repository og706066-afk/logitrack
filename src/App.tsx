import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Roles } from './pages/Roles';
import { Users } from './pages/Users';
import { AuditLogs } from './pages/AuditLogs';
import { CategoriesPage, ProductsPage, SuppliersPage, WarehouseStockPage } from './pages/inventory';
import { StockInPage, StockOutPage } from './pages/transactions';
import { DeliveriesPage, DriversPage, KitchenRequestsPage } from './pages/operations';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';

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
                    <Route path="/products" element={<ProtectedRoute requiredPermission="products.view"><ProductsPage /></ProtectedRoute>} />
                    <Route path="/categories" element={<ProtectedRoute requiredPermission="categories.view"><CategoriesPage /></ProtectedRoute>} />
                    <Route path="/suppliers" element={<ProtectedRoute requiredPermission="suppliers.view"><SuppliersPage /></ProtectedRoute>} />
                    <Route path="/stock-in" element={<ProtectedRoute requiredPermission="stock_in.view"><StockInPage /></ProtectedRoute>} />
                    <Route path="/stock-out" element={<ProtectedRoute requiredPermission="stock_out.view"><StockOutPage /></ProtectedRoute>} />
                    <Route path="/warehouse-stock" element={<ProtectedRoute requiredPermission="stock_batches.view"><WarehouseStockPage /></ProtectedRoute>} />
                    <Route path="/kitchen-requests" element={<ProtectedRoute requiredPermission="requests.view"><KitchenRequestsPage /></ProtectedRoute>} />
                    <Route path="/deliveries" element={<ProtectedRoute requiredPermission="deliveries.view"><DeliveriesPage /></ProtectedRoute>} />
                    <Route path="/drivers" element={<ProtectedRoute requiredPermission="vehicles.view"><DriversPage /></ProtectedRoute>} />
                    <Route path="/reports" element={<ProtectedRoute requiredPermission="reports.view"><ReportsPage /></ProtectedRoute>} />
                    <Route path="/users" element={<ProtectedRoute requiredPermission="users.view"><Users /></ProtectedRoute>} />
                    <Route path="/roles" element={<ProtectedRoute requiredPermission="roles.view"><Roles /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute requiredPermission="users.view"><SettingsPage /></ProtectedRoute>} />
                    <Route path="/audit-logs" element={<ProtectedRoute requiredPermission="users.view"><AuditLogs /></ProtectedRoute>} />
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
