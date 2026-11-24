import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './features/authentication/AuthContext';
import { LoadingState, ToastProvider } from './components/ui';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiveCallDeskPage } from './pages/LiveCallDeskPage';
import { CallsPage } from './pages/CallsPage';
import { CallDetailPage } from './pages/CallDetailPage';
import { CustomersPage } from './pages/CustomersPage';
import { RequestsPage } from './pages/RequestsPage';
import { FollowUpsPage } from './pages/FollowUpsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { BranchesPage } from './pages/BranchesPage';
import { ZonesPage } from './pages/ZonesPage';
import { ReportsPage } from './pages/ReportsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdministrationPage } from './pages/AdministrationPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({
  children,
  permissions,
}: {
  children: React.ReactNode;
  permissions?: string[];
}) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F7F7] p-6">
        <LoadingState message="Verifying ThulasiConnect session..." />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (permissions && !hasPermission(...permissions)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter basename={basename === '/' ? undefined : basename}>
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <LoginPage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route
                  path="/live-call"
                  element={
                    <ProtectedRoute permissions={['live_call:use']}>
                      <LiveCallDeskPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calls"
                  element={
                    <ProtectedRoute
                      permissions={['calls:read_own', 'calls:read_branch', 'calls:read_zone', 'calls:read_org']}
                    >
                      <CallsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calls/:id"
                  element={
                    <ProtectedRoute
                      permissions={['calls:read_own', 'calls:read_branch', 'calls:read_zone', 'calls:read_org']}
                    >
                      <CallDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customers"
                  element={
                    <ProtectedRoute permissions={['customers:read']}>
                      <CustomersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/requests"
                  element={
                    <ProtectedRoute
                      permissions={[
                        'requests:read_own',
                        'requests:read_branch',
                        'requests:read_zone',
                        'requests:read_org',
                      ]}
                    >
                      <RequestsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/followups"
                  element={
                    <ProtectedRoute
                      permissions={[
                        'followups:read_own',
                        'followups:read_branch',
                        'followups:read_zone',
                        'followups:read_org',
                      ]}
                    >
                      <FollowUpsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees"
                  element={
                    <ProtectedRoute
                      permissions={[
                        'performance:read_own',
                        'performance:read_branch',
                        'performance:read_zone',
                        'performance:read_org',
                      ]}
                    >
                      <EmployeesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/branches"
                  element={
                    <ProtectedRoute permissions={['branches:read', 'admin:branches']}>
                      <BranchesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/zones"
                  element={
                    <ProtectedRoute permissions={['zones:read', 'admin:zones']}>
                      <ZonesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute permissions={['reports:branch', 'reports:zone', 'reports:org']}>
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute permissions={['notifications:read']}>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/administration"
                  element={
                    <ProtectedRoute
                      permissions={['admin:users', 'admin:roles', 'admin:integrations', 'admin:audit_logs', 'admin:settings']}
                    >
                      <AdministrationPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/system-health"
                  element={
                    <ProtectedRoute permissions={['admin:audit_logs', 'admin:settings', 'admin:integrations']}>
                      <SystemHealthPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
