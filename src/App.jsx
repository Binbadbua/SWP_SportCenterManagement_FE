import { Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ToastProvider } from './components/Toast.jsx';
import StoreLayout from './layouts/StoreLayout.jsx';
import StaffLayout from './layouts/StaffLayout.jsx';
import Home from './pages/store/Home.jsx';
import Classes from './pages/store/Classes.jsx';
import ClassDetail from './pages/store/ClassDetail.jsx';
import ClassCheckout from './pages/store/ClassCheckout.jsx';
import Schedule from './pages/store/Schedule.jsx';
import Memberships from './pages/store/Memberships.jsx';
import Coaches from './pages/store/Coaches.jsx';
import CoachDetail from './pages/store/CoachDetail.jsx';
import Checkout from './pages/store/Checkout.jsx';
import PaymentResult from './pages/store/PaymentResult.jsx';
import Login from './pages/store/Login.jsx';
import Register from './pages/store/Register.jsx';
import Account from './pages/store/Account.jsx';
import Help from './pages/store/Help.jsx';
import Policy from './pages/store/Policy.jsx';
import InvoicePrint from './pages/InvoicePrint.jsx';
import NotFound from './pages/NotFound.jsx';
import Dashboard from './pages/staff/Dashboard.jsx';
import Attendance from './pages/staff/Attendance.jsx';
import Bookings from './pages/staff/Bookings.jsx';
import StaffNotifications from './pages/staff/Notifications.jsx';
import CrudPage from './pages/staff/CrudPage.jsx';
import { resources } from './pages/staff/resources.jsx';

// Staff list pages: URL -> config in resources.jsx
const CRUD_ROUTES = {
  classes: 'classes',
  schedule: 'schedule',
  rooms: 'rooms',
  sports: 'sports',
  coaches: 'coaches',
  managers: 'managers',
  invoices: 'invoices',
  'my-classes': 'myClasses',
  'my-members': 'myMembers',
  members: 'members',
  receptionists: 'receptionists',
  packages: 'packages',
  memberships: 'memberships',
  accounts: 'accounts',
  'training-plans': 'trainingPlans',
  'training-results': 'trainingResults',
  'audit-log': 'auditLog',
  'support-requests': 'supportRequests',
};

export default function App() {
  const location = useLocation();
  return (
    <ToastProvider>
      <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="classes" element={<Classes />} />
          <Route path="classes/:id" element={<ClassDetail />} />
          <Route path="classes/:id/checkout" element={<ClassCheckout />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="memberships" element={<Memberships />} />
          <Route path="memberships/:id/checkout" element={<Checkout />} />
          <Route path="payment/result" element={<PaymentResult />} />
          <Route path="coaches" element={<Coaches />} />
          <Route path="coaches/:id" element={<CoachDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="account" element={<Account />} />
          <Route path="help" element={<Help />} />
          <Route path="terms" element={<Policy kind="terms" />} />
          <Route path="privacy" element={<Policy kind="privacy" />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="staff" element={<StaffLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="notifications" element={<StaffNotifications />} />
          {Object.entries(CRUD_ROUTES).map(([path, key]) => (
            // key= forces a fresh page (and fresh hooks) when moving between list pages
            <Route key={path} path={path} element={<CrudPage key={key} config={resources[key]} />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* A bare page, so that only the invoice is printed */}
        <Route path="print/invoices/:id" element={<InvoicePrint />} />
      </Routes>
      </ErrorBoundary>
    </ToastProvider>
  );
}
