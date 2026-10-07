import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized, PUBLIC_DOWNLOAD_PREFIX } from "@/lib/auth";

/**
 * Puts every page and Server Action behind HTTP Basic auth, except the build
 * download links in the QR codes, which check for a company-network address
 * in their route instead.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(PUBLIC_DOWNLOAD_PREFIX)) return NextResponse.next();
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
