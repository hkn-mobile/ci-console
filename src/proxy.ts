import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/auth";

/** Puts every page and Server Action behind HTTP Basic auth. */
export function proxy(request: NextRequest) {
  if (!process.env.CONSOLE_PASSWORD) {
    return new NextResponse("CONSOLE_PASSWORD is not set in .env.local", { status: 500 });
  }
  if (isAuthorized(request.headers.get("authorization"))) return NextResponse.next();

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CI Console", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
