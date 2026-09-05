import { NextResponse } from "next/server";

type RouteUser = {
  roles?: string[];
  permissions?: string[];
};

type AuthSuccess = {
  authorization: string;
  user: RouteUser;
};

export type RouteAuthResult = AuthSuccess | { response: NextResponse };

export function getInternalApiBaseUrl(): string {
  const internalOrigin = process.env.INTERNAL_API_ORIGIN?.trim();
  if (internalOrigin) {
    const clean = internalOrigin.replace(/\/$/, "");
    return clean.endsWith("/api/v1") ? clean : `${clean}/api/v1`;
  }
  const internalUrl = process.env.INTERNAL_API_URL?.trim() || process.env.API_URL?.trim();
  if (internalUrl) {
    const clean = internalUrl.replace(/\/$/, "");
    return clean.endsWith("/api/v1") ? clean : `${clean}/api/v1`;
  }
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
  if (configured.startsWith("http://") || configured.startsWith("https://")) {
    return configured.replace(/\/$/, "");
  }
  return "http://127.0.0.1:3001/api/v1";
}

function hasRoutePermission(user: RouteUser, permission: string) {
  if (user.roles?.includes("ADMIN")) return true;
  return Boolean(user.permissions?.includes(permission));
}

export async function requireRoutePermission(request: Request, permission: string): Promise<RouteAuthResult> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return { response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/auth/me`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });

    if (!response.ok) {
      return { response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    }

    const payload = await response.json().catch(() => null);
    const user = (payload?.data || payload || {}) as RouteUser;

    if (!hasRoutePermission(user, permission)) {
      return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
    }

    return { authorization, user };
  } catch (err: any) {
    console.error("[requireRoutePermission] Auth check failed:", err?.message || err);
    return { response: NextResponse.json({ error: "AUTH_CHECK_FAILED" }, { status: 503 }) };
  }
}
