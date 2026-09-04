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

function apiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api/v1";
  return configured.startsWith("http") ? configured.replace(/\/$/, "") : "http://127.0.0.1:3001/api/v1";
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
    const response = await fetch(`${apiBaseUrl()}/auth/me`, {
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
  } catch {
    return { response: NextResponse.json({ error: "AUTH_CHECK_FAILED" }, { status: 503 }) };
  }
}
