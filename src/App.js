 import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navigation from './components/Navigation';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AddPerson from './components/AddPerson';
import Statistics from './components/Statistics';
import ProtectedRoute from './components/ProtectedRoute';
import PersonDebts from './components/PersonDebts';
import GroupPaymentPage from './components/GroupPaymentPage';
import AdminPanel from './components/AdminPanel';
import ChangelogDialog from './components/ChangelogDialog';
import './styles/theme.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { SnackbarProvider } from './contexts/SnackbarContext';
import { UserProfileProvider } from './contexts/UserProfileContext';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SnackbarProvider>
          <UserProfileProvider>
          <Router>
            <div className="App">
              <Navigation />
              <ChangelogDialog />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/statystyki" element={
                  <ProtectedRoute>
                    <Statistics />
                  </ProtectedRoute>
                } />
                <Route path="/dodaj-osobe" element={
                  <ProtectedRoute>
                    <AddPerson />
                  </ProtectedRoute>
                } />
                <Route path="/grupowa-platnosc" element={
                  <ProtectedRoute>
                    <GroupPaymentPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <AdminPanel />
                  </ProtectedRoute>
                } />
                <Route path="/osoba/:id" element={
                  <ProtectedRoute>
                    <PersonDebts />
                  </ProtectedRoute>
                } />
              </Routes>
            </div>
          </Router>
          </UserProfileProvider>
        </SnackbarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 