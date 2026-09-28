import {
  useNavigate,
  useLocation,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from "react-router";
import { useQueryClient } from "@tanstack/react-query";

export function useRouter() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return {
    push: (url: string) => navigate(url),
    replace: (url: string) => navigate(url, { replace: true }),
    back: () => navigate(-1),
    refresh: () => qc.invalidateQueries(),
  };
}

export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  return useRouterParams() as T;
}

export function useSearchParams() {
  const [searchParams, setSearchParams] = useRouterSearchParams();
  return [searchParams, setSearchParams] as const;
}
