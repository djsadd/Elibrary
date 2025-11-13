import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useEffect } from "react";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import AppLayout from "@/components/layout/AppLayout";

import DashboardPage from "../pages/dashboard/DashboardPage";
import ProfilePage from "../pages/profile/ProfilePage";
import { ProtectedRoute, PublicRoute, ProtectedRouteSync, PublicRouteSync } from "@/shared/routes/guards";
import CatalogListPage from "../pages/catalog/CatalogListPage";
import CatalogDetailPage from "../pages/catalog/CatalogDetailPage";
import BookNotesPage from "../pages/notes/BookNotesPage";
import MyShelfPage from "../pages/shelf/MyShelfPage";
import FavoritesPage from "../pages/favorites/FavoritesPage";
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

function WithTitle({ title, children }: { title: string; children: JSX.Element }) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
  return children;
}

const router = createBrowserRouter([
  { path: "/login", element: <PublicRouteSync><WithTitle title="Login - TAU"><LoginPage /></WithTitle></PublicRouteSync> },
  { path: "/auth/login", element: <PublicRouteSync><WithTitle title="Login - TAU"><LoginPage /></WithTitle></PublicRouteSync> },
  { path: "/auth/register", element: <PublicRouteSync><WithTitle title="Register - TAU"><RegisterPage /></WithTitle></PublicRouteSync> },
  { path: "/auth/forgot", element: <PublicRouteSync><WithTitle title="Forgot Password - TAU"><ForgotPasswordPage /></WithTitle></PublicRouteSync> },
  {
    path: "/",
    element: (
      <ProtectedRouteSync>
        <AppLayout />
      </ProtectedRouteSync>
    ),
      children: [
      { index: true, element: <WithTitle title="Dashboard - TAU"><DashboardPage /></WithTitle> },
      { path: "profile", element: <WithTitle title="Profile - TAU"><ProfilePage /></WithTitle> },
      { path: "catalog", element: <WithTitle title="Catalog - TAU"><CatalogListPage /></WithTitle> },
      { path: "catalog/:id", element: <WithTitle title="Book Details - TAU"><CatalogDetailPage /></WithTitle> },
      { path: "catalog/books/:id", element: <WithTitle title="Book Details - TAU"><CatalogDetailPage /></WithTitle> },
      { path: "catalog/:id/notes", element: <WithTitle title="My Notes - TAU"><BookNotesPage /></WithTitle> },
      { path: "shelf", element: <WithTitle title="My Shelf - TAU"><MyShelfPage /></WithTitle> },
      { path: "favorites", element: <WithTitle title="Favorites - TAU"><FavoritesPage /></WithTitle> },
      { path: "reader", element: <WithTitle title="Reader - TAU"><ReaderPage /></WithTitle> },
        {
          path: "admin",
          element: <WithTitle title="Admin - TAU"><AdminLayout /></WithTitle>,
          children: [
            { index: true, element: <WithTitle title="Admin Home - TAU"><AdminHome /></WithTitle> },
            { path: "books", element: <WithTitle title="Admin Books - TAU"><BooksListPage /></WithTitle> },
            { path: "books/new", element: <WithTitle title="Add Book - TAU"><CreateBookPage /></WithTitle> },
            { path: "books/:id/edit", element: <WithTitle title="Edit Book - TAU"><EditBookPage /></WithTitle> },
            { path: "playlists", element: <WithTitle title="Admin Playlists - TAU"><PlaylistsListPage /></WithTitle> },
            { path: "playlists/new", element: <WithTitle title="Add Playlist - TAU"><CreatePlaylistPage /></WithTitle> },
            { path: "playlists/:id/edit", element: <WithTitle title="Edit Playlist - TAU"><EditPlaylistPage /></WithTitle> },
            { path: "users", element: <WithTitle title="Admin Users - TAU"><UsersPage /></WithTitle> },
            { path: "authors", element: <WithTitle title="Admin Authors - TAU"><AuthorsPage /></WithTitle> },
            { path: "subjects", element: <WithTitle title="Admin Subjects - TAU"><SubjectsPage /></WithTitle> },
            { path: "files", element: <WithTitle title="Admin Files - TAU"><FilesPage /></WithTitle> },
            { path: "roles", element: <WithTitle title="Admin Roles - TAU"><RolesPage /></WithTitle> },
            { path: "reports", element: <WithTitle title="Admin Reports - TAU"><ReportsPage /></WithTitle> },
            { path: "settings", element: <WithTitle title="Admin Settings - TAU"><SettingsPage /></WithTitle> },
          ],
        },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
