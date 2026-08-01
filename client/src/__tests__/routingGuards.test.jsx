import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import AdminRoute from "../components/AdminRoute";

afterEach(cleanup);

const renderRoutes = (auth, initial = "/private") => render(
    <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[initial]}>
            <Routes>
                <Route path="/login" element={<div>Login screen</div>} />
                <Route path="/dashboard" element={<div>Dashboard screen</div>} />
                <Route path="/private" element={<ProtectedRoute><div>Private screen</div></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminRoute><div>Admin screen</div></AdminRoute></ProtectedRoute>} />
            </Routes>
        </MemoryRouter>
    </AuthContext.Provider>,
);

describe("route authorization guards", () => {
    it("redirects a signed-out user to login", () => {
        renderRoutes({ user: null, loading: false });
        expect(screen.getByText("Login screen")).toBeTruthy();
        expect(screen.queryByText("Private screen")).toBeNull();
    });

    it("allows an authenticated user to access protected content", () => {
        renderRoutes({ user: { _id: "user-1", role: "user" }, loading: false });
        expect(screen.getByText("Private screen")).toBeTruthy();
    });

    it("redirects a non-admin away from admin content", () => {
        renderRoutes({ user: { _id: "user-1", role: "user" }, loading: false }, "/admin");
        expect(screen.getByText("Dashboard screen")).toBeTruthy();
        expect(screen.queryByText("Admin screen")).toBeNull();
    });

    it("allows an admin to access admin content", () => {
        renderRoutes({ user: { _id: "admin-1", role: "admin" }, loading: false }, "/admin");
        expect(screen.getByText("Admin screen")).toBeTruthy();
    });
});
