import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
import { LoginPage } from "@/src/pages/login";
import HomePage from "@/src/pages/home";
import { ListRoute } from "@/src/pages/list";

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/l/:listId" element={<ListRoute />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Providers>
  );
}
