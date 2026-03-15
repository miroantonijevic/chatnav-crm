import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/Login'
import { ChangePasswordPage } from './pages/ChangePassword'
import { DashboardPage } from './pages/Dashboard'
import { ContactsListPage } from './pages/ContactsList'
import { ContactDetailPage } from './pages/ContactDetail'
import { CompaniesListPage } from './pages/CompaniesList'
import { CompanyDetailPage } from './pages/CompanyDetail'
import { UsersPage } from './pages/Users'
import { RemindersPage } from './pages/Reminders'
import './App.css'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/contacts"
            element={
              <ProtectedRoute>
                <ContactsListPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/contacts/:id"
            element={
              <ProtectedRoute>
                <ContactDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/companies"
            element={
              <ProtectedRoute>
                <CompaniesListPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/companies/:id"
            element={
              <ProtectedRoute>
                <CompanyDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute requireAdmin>
                <UsersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reminders"
            element={
              <ProtectedRoute requireAdmin>
                <RemindersPage />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
