import React from 'react';
import './App.css';
import KanbanBoard from './KanbanBoard';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { KanbanProvider } from './KanbanContext';
import Dashboard from './pages/Dashboard';
import Summary from './pages/Summary';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';

// Define the custom Kavia theme
const kaviaTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#E87A41", // Kavia Orange
      contrastText: "#ffffff"
    },
    secondary: {
      main: "#FFF3E9", // Light Kavia panel/surface
      contrastText: "#1A1A1A"
    },
    background: {
      default: "#FFF7F0", // App background
      paper: "#FFFFFF"    // Paper/surfaces
    },
    info: {
      main: "#E87A41"
    },
    success: {
      main: "#36B37E"
    },
    text: {
      primary: "#1A1A1A",
      secondary: "#5C5C5C"
    }
  },
  typography: {
    fontFamily: ["Inter", "Roboto", "Helvetica", "Arial", "sans-serif"].join(","),
    fontWeightMedium: 500,
    fontWeightBold: 700
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: {
          backgroundColor: "#FFF3E9",
          color: "#E87A41",
          borderBottom: "2px solid #E87A41",
          boxShadow: "none"
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 7,
          textTransform: "none",
          fontWeight: 600,
          backgroundColor: "#C9612F",
          color: "#fff",
          "&:hover": {
            backgroundColor: "#E87A41"
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 13
        }
      }
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#FFF7F0"
        }
      }
    }
  }
});

function NavUserControls() {
  const { user, role, logout, dummyCredentials } = useAuth();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {user ? (
        <>
          <span
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(232, 122, 65, 0.16)',
              border: '1px solid rgba(232, 122, 65, 0.35)',
              color: '#C9612F',
              fontWeight: 800,
              fontSize: 13,
            }}
            title={
              role === 'reader'
                ? 'Reader: view-only (no create/edit/delete/drag/move)'
                : 'Editor: full access'
            }
            aria-label={`Signed in as ${role}`}
          >
            {role === 'reader' ? 'Reader (view-only)' : 'Editor'}
          </span>

          <button className="btn" type="button" onClick={logout} style={{ padding: '7px 12px' }}>
            Logout
          </button>
        </>
      ) : (
        <span style={{ fontSize: 13, opacity: 0.85 }}>
          Demo login required. Usernames: Reader <code>{dummyCredentials?.find((d) => d.role === 'reader')?.username}</code>, Editor{' '}
          <code>{dummyCredentials?.find((d) => d.role === 'editor')?.username}</code>.
        </span>
      )}
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  return (
    <ThemeProvider theme={kaviaTheme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <KanbanProvider>
            <div className="app">
              <nav className="navbar">
                <div className="container">
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 12 }}>
                    <div className="logo">
                      <span className="logo-symbol">*</span> Kavia Kanban
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div className="nav-links" role="navigation" aria-label="Primary">
                        <NavLink
                          to="/"
                          end
                          className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                        >
                          Dashboard
                        </NavLink>
                        <NavLink
                          to="/product"
                          className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                        >
                          Product
                        </NavLink>
                        <NavLink
                          to="/summary"
                          className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                        >
                          Summary
                        </NavLink>
                      </div>

                      <NavUserControls />
                    </div>
                  </div>
                </div>
              </nav>

              <main>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route
                    path="/"
                    element={
                      <RequireAuth>
                        <Dashboard />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/product"
                    element={
                      <RequireAuth>
                        <KanbanBoard />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/summary"
                    element={
                      <RequireAuth>
                        <Summary />
                      </RequireAuth>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </KanbanProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
