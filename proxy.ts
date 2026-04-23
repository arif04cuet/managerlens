import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Public routes — always accessible
  if (pathname.startsWith("/login")) {
    if (user) return redirectToDashboard(request, supabase);
    return response;
  }

  if (pathname.startsWith("/signup") || pathname.startsWith("/auth/")) {
    return response;
  }

  // Protected routes — require auth
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Role-based guard for /admin
  if (pathname.startsWith("/admin")) {
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userData?.role !== "super_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function redirectToDashboard(request: NextRequest, supabase: any) {
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .single();
  const dest = userData?.role === "super_admin" ? "/admin" : "/dashboard";
  return NextResponse.redirect(new URL(dest, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};
