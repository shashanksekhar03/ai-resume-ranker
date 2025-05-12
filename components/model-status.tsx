"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { checkModelAccess } from "@/actions/check-model-access"

export function ModelStatus() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState<string>("")

  useEffect(() => {
    const verifyModelAccess = async () => {
      try {
        const result = await checkModelAccess()
        if (result.success) {
          setStatus("success")
          setMessage(`Successfully connected to ${result.model}`)
        } else {
          setStatus("error")
          setMessage(result.error || "Failed to access the required model")
        }
      } catch (error) {
        setStatus("error")
        setMessage("Error checking model access")
      }
    }

    verifyModelAccess()
  }, [])

  if (status === "loading") {
    return (
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
        <AlertDescription className="text-blue-800">Verifying API access to GPT-4o...</AlertDescription>
      </Alert>
    )
  }

  if (status === "error") {
    return (
      <Alert className="mb-6 bg-red-50 border-red-200">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          {message}. The application will use fallback methods if needed.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="mb-6 bg-green-50 border-green-200">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">{message}</AlertDescription>
    </Alert>
  )
}
