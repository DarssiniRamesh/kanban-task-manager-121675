import React from 'react';
import './App.css';
import KanbanBoard from './KanbanBoard';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { KanbanProvider } from './KanbanContext';
import Dashboard from './pages/Dashboard';
import Summary from './pages/Summary';

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

// PUBLIC_INTERFACE
function App() {
  return (
    <ThemeProvider theme={kaviaTheme}>
      <CssBaseline />
      <Router>
        <KanbanProvider>
          <div className="app">
            <nav className="navbar">
              <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div className="logo">
                    <span className="logo-symbol">*</span> Kavia Kanban
                  </div>
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
                </div>
              </div>
            </nav>

            <main>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/product" element={<KanbanBoard />} />
                <Route path="/summary" element={<Summary />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </KanbanProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
