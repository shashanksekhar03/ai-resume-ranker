/**
 * Utility to detect the current environment and provide environment-specific configurations
 */

// Check if we're running in production
export function isProduction(): boolean {
  // Check for production-specific environment variables or URLs
  if (typeof window !== "undefined") {
    // Client-side detection
    const hostname = window.location.hostname
    return (
      !hostname.includes("localhost") &&
      !hostname.includes("127.0.0.1") &&
      !hostname.includes("vercel.app") &&
      !hostname.includes("preview")
    )
  } else {
    // Server-side detection
    return process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV?.includes("preview")
  }
}

// Check if we're running in preview
export function isPreview(): boolean {
  if (typeof window !== "undefined") {
    // Client-side detection
    const hostname = window.location.hostname
    return hostname.includes("preview") || hostname.includes("vercel.app")
  } else {
    // Server-side detection
    return process.env.VERCEL_ENV?.includes("preview") || false
  }
}

// Get environment-specific configuration
export function getEnvironmentConfig() {
  return {
    isProduction: isProduction(),
    isPreview: isPreview(),
    // Add any other environment-specific configurations here
  }
}
