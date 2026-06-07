import { Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import ApplicationListPage from './pages/ApplicationListPage';
import ChairmanApplicationPage from './pages/ChairmanApplicationPage';
import ApplicationDetailPage from './pages/ApplicationDetailPage';
import PioProjectReviewPage from './pages/PioProjectReviewPage';
import UnoProjectDecisionPage from './pages/UnoProjectDecisionPage';
import UserManagementPage from './pages/UserManagementPage';
import UserDetailPage from './pages/UserDetailPage';
import { SETTINGS_DEFAULT_PATH } from './config/settingsNav';
import SettingsLayout from './pages/settings/SettingsLayout';
import ProjectFormSettingsPage from './pages/settings/ProjectFormSettingsPage';
import RoleUserFormSettingsPage from './pages/settings/RoleUserFormSettingsPage';
import ProjectTypesPage from './pages/settings/ProjectTypesPage';
import PioFieldPermissionsPage from './pages/settings/PioFieldPermissionsPage';
import UnoReviewFieldsPage from './pages/settings/UnoReviewFieldsPage';
import AssessmentRulesPage from './pages/settings/AssessmentRulesPage';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import type { Role } from './types/user';

function RoleHomeRedirect() {
  const { user } = useAuth();
  const role = user?.role as Role | undefined;
  switch (role) {
    case 'Chairman':
      return <Navigate to="/applications" replace />;
    case 'PIO':
      return <Navigate to="/pio/review" replace />;
    case 'UNO':
      return <Navigate to="/uno/approvals" replace />;
    case 'Super Admin':
    case 'Admin':
      return <Navigate to="/admin/projects" replace />;
    default:
      return <Navigate to="/applications" replace />;
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RoleHomeRedirect />} />

        <Route
          path="/applications"
          element={
            <ProtectedRoute requireRoles={['Chairman', 'Super Admin', 'Admin']}>
              <ApplicationListPage
                titleKey="applications.myTitle"
                subtitleKey="applications.mySubtitle"
                showAddButton
                detailPathPrefix="/applications"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications/new"
          element={
            <ProtectedRoute requireRoles={['Chairman']}>
              <ChairmanApplicationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications/:id"
          element={
            <ProtectedRoute requireRoles={['Chairman', 'Super Admin', 'Admin']}>
              <ApplicationDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pio/review"
          element={
            <ProtectedRoute requireRoles={['PIO']}>
              <ApplicationListPage
                titleKey="pio.queueTitle"
                subtitleKey="pio.queueSubtitle"
                detailPathPrefix="/pio/projects"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pio/projects/:id"
          element={
            <ProtectedRoute requireRoles={['PIO']}>
              <PioProjectReviewPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/uno/approvals"
          element={
            <ProtectedRoute requireRoles={['UNO']}>
              <ApplicationListPage
                titleKey="uno.queueTitle"
                subtitleKey="uno.queueSubtitle"
                detailPathPrefix="/uno/projects"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/uno/projects/:id"
          element={
            <ProtectedRoute requireRoles={['UNO']}>
              <UnoProjectDecisionPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/projects"
          element={
            <ProtectedRoute requireRoles={['Super Admin', 'Admin']}>
              <ApplicationListPage
                titleKey="admin.projectsTitle"
                subtitleKey="admin.projectsSubtitle"
                detailPathPrefix="/admin/projects"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/projects/:id"
          element={
            <ProtectedRoute requireRoles={['Super Admin', 'Admin']}>
              <ApplicationDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute requireRoles={['Super Admin', 'Admin']}>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:id"
          element={
            <ProtectedRoute requireRoles={['Super Admin', 'Admin']}>
              <UserDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute requireRoles={['Super Admin', 'Admin']}>
              <SettingsLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={SETTINGS_DEFAULT_PATH} replace />} />
          <Route
            path="user-forms/chairman"
            element={
              <RoleUserFormSettingsPage
                schemaKey="chairman_user_create"
                systemFieldKeys={new Set(['username', 'nid_number', 'assigned_region', 'address'])}
                titleKey="settings.chairmanUserForm"
                descKey="settings.chairmanUserFormDesc"
              />
            }
          />
          <Route
            path="user-forms/pio"
            element={
              <RoleUserFormSettingsPage
                schemaKey="pio_user_create"
                systemFieldKeys={new Set(['username', 'employee_id', 'designation', 'assigned_upazila_key'])}
                titleKey="settings.pioUserForm"
                descKey="settings.pioUserFormDesc"
              />
            }
          />
          <Route
            path="user-forms/uno"
            element={
              <RoleUserFormSettingsPage
                schemaKey="uno_user_create"
                systemFieldKeys={new Set(['username', 'employee_id', 'designation', 'assigned_upazila_key'])}
                titleKey="settings.unoUserForm"
                descKey="settings.unoUserFormDesc"
              />
            }
          />
          <Route path="project/form" element={<ProjectFormSettingsPage />} />
          <Route path="project/types" element={<ProjectTypesPage />} />
          <Route path="permissions/pio" element={<PioFieldPermissionsPage />} />
          <Route path="review/assessment-rules" element={<AssessmentRulesPage />} />
          <Route path="review/uno" element={<UnoReviewFieldsPage />} />
          {/* Legacy paths */}
          <Route path="project-form" element={<Navigate to="/settings/project/form" replace />} />
          <Route path="user-form" element={<Navigate to="/settings/user-forms/chairman" replace />} />
          <Route path="project-types" element={<Navigate to="/settings/project/types" replace />} />
          <Route path="pio-permissions" element={<Navigate to="/settings/permissions/pio" replace />} />
          <Route path="uno-review" element={<Navigate to="/settings/review/uno" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
