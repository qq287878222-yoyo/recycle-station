import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerLayout from './layouts/CustomerLayout';
import AdminLayout from './layouts/AdminLayout';
import Catalog from './pages/customer/Catalog';
import NewOrder from './pages/customer/NewOrder';
import MyOrders from './pages/customer/MyOrders';
import TeamOrders from './pages/customer/TeamOrders';
import Income from './pages/customer/Income';
import Invite from './pages/customer/Invite';
import Profile from './pages/customer/Profile';
import AdminItems from './pages/admin/Items';
import AdminCategories from './pages/admin/Categories';
import AdminOrders from './pages/admin/Orders';
import AdminAgents from './pages/admin/Agents';
import AdminStats from './pages/admin/Stats';
import AdminWarehouse from './pages/admin/Warehouse';
import RequireAuth from './components/RequireAuth';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <CustomerLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="catalog" replace />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="new-order" element={<NewOrder />} />
          <Route path="my-orders" element={<MyOrders />} />
          <Route path="team-orders" element={<TeamOrders />} />
          <Route path="income" element={<Income />} />
          <Route path="invite" element={<Invite />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAuth requireAdmin>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="orders" replace />} />
          <Route path="items" element={<AdminItems />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="agents" element={<AdminAgents />} />
          <Route path="stats" element={<AdminStats />} />
          <Route path="warehouse" element={<AdminWarehouse />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
