import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { OPENAI_API_KEY } from "@/lib/ai-config"

// This middleware runs before every request
export function middleware(request: NextRequest) {
  // Create a new response
  const response = NextResponse.next()

  // Set the API key as a header that our server components can access
  response.headers.set("x-openai-api-key", OPENAI_API_KEY)

  return response
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: ["/api/:path*", "/"],
}
