import { createBrowserRouter, RouterProvider } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import AppLayout from "@/components/layout/AppLayout";

import DashboardPage from "../pages/dashboard/DashboardPage";
import ProfilePage from "../pages/profile/ProfilePage";
import { ProtectedRoute, PublicRoute, ProtectedRouteSync, PublicRouteSync } from "@/shared/routes/guards";
import CatalogListPage from "../pages/catalog/CatalogListPage";
import CatalogDetailPage from "../pages/catalog/CatalogDetailPage";
import MyShelfPage from "../pages/shelf/MyShelfPage";
import ReaderPage from "../pages/reader/ReaderPage";
import AdminLayout from "../pages/admin/AdminLayout";
import AdminHome from "../pages/admin/AdminHome";
import CreateBookPage from "../pages/admin/CreateBookPage";
import CreatePlaylistPage from "../pages/admin/CreatePlaylistPage";
import BooksListPage from "../pages/admin/sections/BooksListPage";
import PlaylistsListPage from "../pages/admin/sections/PlaylistsListPage";
import EditBookPage from "../pages/admin/EditBookPage";
import EditPlaylistPage from "../pages/admin/EditPlaylistPage";
import UsersPage from "../pages/admin/sections/UsersPage";
import AuthorsPage from "../pages/admin/sections/AuthorsPage";
import SubjectsPage from "../pages/admin/sections/SubjectsPage";
import FilesPage from "../pages/admin/sections/FilesPage";
import SettingsPage from "../pages/admin/sections/SettingsPage";
import ReportsPage from "../pages/admin/sections/ReportsPage";
import RolesPage from "../pages/admin/sections/RolesPage";

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
      { path: "catalog/books/:id", element: <CatalogDetailPage /> },
      { path: "shelf", element: <MyShelfPage /> },
      { path: "reader", element: <ReaderPage /> },
        {
          path: "admin",
          element: <AdminLayout />,
          children: [
            { index: true, element: <AdminHome /> },
            { path: "books", element: <BooksListPage /> },
            { path: "books/new", element: <CreateBookPage /> },
            { path: "books/:id/edit", element: <EditBookPage /> },
            { path: "playlists", element: <PlaylistsListPage /> },
            { path: "playlists/new", element: <CreatePlaylistPage /> },
            { path: "playlists/:id/edit", element: <EditPlaylistPage /> },
            { path: "users", element: <UsersPage /> },
            { path: "authors", element: <AuthorsPage /> },
            { path: "subjects", element: <SubjectsPage /> },
            { path: "files", element: <FilesPage /> },
            { path: "roles", element: <RolesPage /> },
            { path: "reports", element: <ReportsPage /> },
            { path: "settings", element: <SettingsPage /> },
          ],
        },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
