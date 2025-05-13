"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { saveApiKey } from "@/actions/save-api-key"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

interface ApiKeyManagerProps {
  onKeySaved: () => void
}

export function ApiKeyManager({ onKeySaved }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!apiKey.trim()) {
      setStatus("error")
      setMessage("Please enter an API key")
      return
    }

    setIsSubmitting(true)
    setStatus("idle")

    try {
      const result = await saveApiKey(apiKey.trim())

      if (result.success) {
        setStatus("success")
        setMessage("API key saved successfully!")
        onKeySaved()
      } else {
        setStatus("error")
        setMessage(result.message || "Failed to save API key")
      }
    } catch (error) {
      setStatus("error")
      setMessage("An error occurred while saving the API key")
      console.error("Error saving API key:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Configure OpenAI API Key</CardTitle>
        <CardDescription>
          Enter your OpenAI API key to enable AI-powered resume ranking. Your key will be securely stored as an
          environment variable.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                Your API key will be stored securely and used only for this application.
              </p>
            </div>

            {status === "success" && (
              <div className="flex items-center text-sm text-green-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                {message}
              </div>
            )}

            {status === "error" && (
              <div className="flex items-center text-sm text-red-600">
                <XCircle className="h-4 w-4 mr-2" />
                {message}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save API Key"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
