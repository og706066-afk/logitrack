import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataSyncProvider } from './contexts/DataSyncContext';
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
import { NeedsPage } from './pages/needs';
import { ShipmentsPage } from './pages/shipments';
import { StockControlPage } from './pages/stockControl';
import { MasterDataPage } from './pages/masterData';
import { FinancePage } from './pages/finance';
import { RegionsPage } from './pages/regions';
import { ReportsAdvancedPage } from './pages/reportsAdvanced';

export function App() {
  return (
    <ThemeProvider>
      <DataSyncProvider>
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
                        <Route path="/" element={<ProtectedRoute requiredPermission="dashboard.view"><Dashboard /></ProtectedRoute>} />
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
                        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                        <Route path="/audit-logs" element={<ProtectedRoute requiredPermission="users.view"><AuditLogs /></ProtectedRoute>} />
                        <Route path="/needs" element={<ProtectedRoute requiredPermission="needsRequests.view"><NeedsPage /></ProtectedRoute>} />
                        <Route path="/shipments" element={<ProtectedRoute requiredPermission="shipments.view"><ShipmentsPage /></ProtectedRoute>} />
                        <Route path="/stock-control" element={<ProtectedRoute requiredPermission="stockTransactions.view"><StockControlPage /></ProtectedRoute>} />
                        <Route path="/master-data" element={<ProtectedRoute requiredPermission="kordas.view"><MasterDataPage /></ProtectedRoute>} />
                        <Route path="/finance" element={<ProtectedRoute requiredPermission="finance.view"><FinancePage /></ProtectedRoute>} />
                        <Route path="/regions" element={<ProtectedRoute requiredPermission="regions.view"><RegionsPage /></ProtectedRoute>} />
                        <Route path="/reports-advanced" element={<ProtectedRoute requiredPermission="reports.view"><ReportsAdvancedPage /></ProtectedRoute>} />
                      </Routes>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </DataSyncProvider>
    </ThemeProvider>
  );
}

export default App;
