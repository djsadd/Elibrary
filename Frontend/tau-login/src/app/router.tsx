import { createBrowserRouter, RouterProvider } from "react-router-dom";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import AppLayout from "@/components/layout/AppLayout";

import DashboardPage from "@/pages/dashboard/DashboardPage";
import ProfilePage from "@/pages/profile/ProfilePage";
import { ProtectedRoute, PublicRoute, ProtectedRouteSync, PublicRouteSync } from "@/shared/routes/guards";
import CatalogListPage from "@/pages/catalog/CatalogListPage";
import CatalogDetailPage from "@/pages/catalog/CatalogDetailPage";
import MyShelfPage from "@/pages/shelf/MyShelfPage";
import ReaderPage from "../pages/reader/ReaderPage";
import AdminLayout from "../pages/admin/AdminLayout";
import AdminHome from "../pages/admin/AdminHome";
import CreateBookPage from "../pages/admin/CreateBookPage";
import CreatePlaylistPage from "../pages/admin/CreatePlaylistPage";

const router = createBrowserRouter([
  { path: "/login", element: <PublicRouteSync><LoginPage /></PublicRouteSync> },
  { path: "/auth/login", element: <PublicRouteSync><LoginPage /></PublicRouteSync> },
  { path: "/auth/register", element: <PublicRouteSync><RegisterPage /></PublicRouteSync> },
  { path: "/auth/forgot", element: <PublicRouteSync><ForgotPasswordPage /></PublicRouteSync> },
  {
    path: "/",
    element: (
      <ProtectedRouteSync>
        <AppLayout />
      </ProtectedRouteSync>
    ),
      children: [
      { index: true, element: <DashboardPage /> },
  { path: "profile", element: <ProfilePage /> },
      { path: "catalog", element: <CatalogListPage /> },
      { path: "catalog/:id", element: <CatalogDetailPage /> },
      { path: "shelf", element: <MyShelfPage /> },
      { path: "reader", element: <ReaderPage /> },
        {
          path: "admin",
          element: <AdminLayout />,
          children: [
            { index: true, element: <AdminHome /> },
            { path: "books/new", element: <CreateBookPage /> },
            { path: "playlists/new", element: <CreatePlaylistPage /> },
          ],
        },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
