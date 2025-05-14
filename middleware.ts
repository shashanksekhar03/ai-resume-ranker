import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { OPENAI_API_KEY } from "@/lib/ai-config"

// This middleware runs before every request
export function middleware(request: NextRequest) {
  // Create a new response
  const response = NextResponse.next()

  // Set the API key as a header that our server components can access
  try {
    // Ensure we're using the correct API key
    const apiKey = OPENAI_API_KEY

    if (apiKey) {
      // Set the API key in headers
      response.headers.set("x-openai-api-key", apiKey)

      // Also set it as an environment variable for server components
      if (typeof process !== "undefined" && process.env) {
        process.env.OPENAI_API_KEY = apiKey
      }
    }
  } catch (error) {
    console.error("Error setting API key header:", error)
  }

  return response
}

// Configure the middleware to run on all paths except static assets
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
