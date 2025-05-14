"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2, Info } from "lucide-react"
import { checkModelAccess } from "@/actions/check-model-access"
import { MODEL, FALLBACK_MODEL } from "@/lib/ai-config"

export function ModelStatus() {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "warning">("loading")
  const [message, setMessage] = useState<string>("")
  const [details, setDetails] = useState<string>("")

  useEffect(() => {
    const verifyModelAccess = async () => {
      try {
        const result = await checkModelAccess()
        if (result.success) {
          setStatus("success")
          setMessage(`Successfully connected to ${result.model || MODEL}`)
          setDetails(`Using ${result.model || MODEL} for optimal resume ranking results.`)
        } else if (result.error && result.error.includes("doesn't have access")) {
          // API key works but doesn't have access to the preferred model
          setStatus("warning")
          setMessage(result.error)
          setDetails(`Using ${FALLBACK_MODEL} as a fallback. Results may be less detailed but still useful.`)
        } else {
          setStatus("error")
          setMessage(result.error || "Failed to access the required model")
          setDetails(
            "The application will use a built-in algorithm for ranking. This provides basic matching but lacks detailed analysis.",
          )
        }
      } catch (error) {
        setStatus("error")
        setMessage("Error checking model access. Using fallback ranking method.")
        setDetails(
          "The application will use a built-in algorithm for ranking. This provides basic matching but lacks detailed analysis.",
        )
      }
    }

    verifyModelAccess()
  }, [])

  if (status === "loading") {
    return (
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
        <AlertDescription className="text-blue-800">
          <div className="font-medium">Verifying API access...</div>
          <div className="text-xs mt-1">Connecting to OpenAI to check model availability.</div>
        </AlertDescription>
      </Alert>
    )
  }

  if (status === "error") {
    return (
      <Alert className="mb-6 bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <div className="font-medium">{message || "API access unavailable"}</div>
          <div className="text-xs mt-1">{details}</div>
        </AlertDescription>
      </Alert>
    )
  }

  if (status === "warning") {
    return (
      <Alert className="mb-6 bg-amber-50 border-amber-200">
        <Info className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <div className="font-medium">{message}</div>
          <div className="text-xs mt-1">{details}</div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="mb-6 bg-green-50 border-green-200">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        <div className="font-medium">{message}</div>
        <div className="text-xs mt-1">{details}</div>
      </AlertDescription>
    </Alert>
  )
}
