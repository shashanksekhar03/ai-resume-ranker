"use server"

import { cookies } from "next/headers"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

interface SaveApiKeyResult {
  success: boolean
  message?: string
}

export async function saveApiKey(apiKey: string): Promise<SaveApiKeyResult> {
  try {
    // Validate the API key by making a simple request
    const isValid = await validateApiKey(apiKey)

    if (!isValid) {
      return {
        success: false,
        message: "Invalid API key. Please check your key and try again.",
      }
    }

    // Store the API key in a secure cookie (encrypted in production)
    // In a real production app, you'd want to store this more securely
    cookies().set("openai-api-key", apiKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    })

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error saving API key:", error)
    return {
      success: false,
      message: "An error occurred while saving the API key",
    }
  }
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    // Make a minimal request to validate the API key
    const response = await generateText({
      model: openai("gpt-3.5-turbo", {
        apiKey: apiKey,
        maxTokens: 5,
      }),
      prompt: "Say OK",
    })

    return response.text.toLowerCase().includes("ok")
  } catch (error) {
    console.error("API key validation error:", error)
    return false
  }
}
