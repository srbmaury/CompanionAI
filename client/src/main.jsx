import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { OrganizationProvider } from "./context/OrganizationContext.jsx";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

// MUI
import { ThemeModeProvider } from "./context/ThemeContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <NotificationProvider>
        <BrowserRouter>
          <AuthProvider>
            <OrganizationProvider>
              <App />
            </OrganizationProvider>
          </AuthProvider>
        </BrowserRouter>
      </NotificationProvider>
    </ThemeModeProvider>
  </React.StrictMode>
);