import { lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { Button, Loading } from './components/ui.jsx';
import { Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ToastProvider } from './components/Toast.jsx';
import StoreLayout from './layouts/StoreLayout.jsx';
import StaffLayout from './layouts/StaffLayout.jsx';
import Home from './pages/store/Home.jsx';
const Classes = lazy(() => import('./pages/store/Classes.jsx'));
const ClassDetail = lazy(() => import('./pages/store/ClassDetail.jsx'));
const ClassCheckout = lazy(() => import('./pages/store/ClassCheckout.jsx'));
const Schedule = lazy(() => import('./pages/store/Schedule.jsx'));
const Memberships = lazy(() => import('./pages/store/Memberships.jsx'));
const Coaches = lazy(() => import('./pages/store/Coaches.jsx'));
const CoachDetail = lazy(() => import('./pages/store/CoachDetail.jsx'));
const Checkout = lazy(() => import('./pages/store/Checkout.jsx'));
const UpgradeCheckout = lazy(() => import('./pages/store/UpgradeCheckout.jsx'));
const PaymentResult = lazy(() => import('./pages/store/PaymentResult.jsx'));
const Login = lazy(() => import('./pages/store/Login.jsx'));
const Register = lazy(() => import('./pages/store/Register.jsx'));
const Account = lazy(() => import('./pages/store/Account.jsx'));
const Help = lazy(() => import('./pages/store/Help.jsx'));
const Policy = lazy(() => import('./pages/store/Policy.jsx'));
const InvoicePrint = lazy(() => import('./pages/InvoicePrint.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Dashboard = lazy(() => import('./pages/staff/Dashboard.jsx'));
const Attendance = lazy(() => import('./pages/staff/Attendance.jsx'));
const Bookings = lazy(() => import('./pages/staff/Bookings.jsx'));
const CheckIns = lazy(() => import('./pages/staff/CheckIns.jsx'));
const StaffNotifications = lazy(() => import('./pages/staff/Notifications.jsx'));
const ResourceRoute = lazy(() => import('./pages/staff/ResourceRoute.jsx'));
const AiChatWidget = lazy(() => import('./components/AiChatWidget.jsx'));

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
  const { user } = useAuth();
  const identity = [user?.accountId ?? 'guest', user?.role ?? user?.Role ?? '', user?.access_token ?? ''].join(':');
  return (
    <ToastProvider>
      <ErrorBoundary key={identity} resetKey={location.pathname + location.search}>
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="classes" element={<Classes />} />
          <Route path="classes/:id" element={<ClassDetail />} />
          <Route path="classes/:id/checkout" element={<ClassCheckout />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="memberships" element={<Memberships />} />
          <Route path="memberships/:id/checkout" element={<Checkout />} />
          <Route path="memberships/upgrade" element={<UpgradeCheckout />} />
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
          <Route path="check-ins" element={<CheckIns />} />
          <Route path="notifications" element={<StaffNotifications />} />
          {Object.entries(CRUD_ROUTES).map(([path, key]) => (
            // key= forces a fresh page (and fresh hooks) when moving between list pages
            <Route key={path} path={path} element={<ResourceRoute key={key} resourceKey={key} />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* A bare page, so that only the invoice is printed */}
        <Route path="print/invoices/:id" element={<Suspense fallback={<Loading label="Đang mở hóa đơn" />}><InvoicePrint /></Suspense>} />
      </Routes>
      </ErrorBoundary>
      {!location.pathname.startsWith('/print/') && (
        <ErrorBoundary key={'chat:' + identity} resetKey={identity} fallback={({ retry }) => (
          <Button variant="secondary" size="sm" onClick={retry}
            style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 65 }}>Thử mở lại trợ lý AI</Button>
        )}>
          <Suspense fallback={null}><AiChatWidget /></Suspense>
        </ErrorBoundary>
      )}
    </ToastProvider>
  );
}
