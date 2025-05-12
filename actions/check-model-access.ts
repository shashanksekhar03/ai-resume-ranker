"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

// Define the model to use throughout the application
const MODEL = "gpt-4o"

interface ModelAccessResult {
  success: boolean
  model?: string
  error?: string
}

export async function checkModelAccess(): Promise<ModelAccessResult> {
  try {
    // Try a simple generation to check if we have access to the model
    const { text } = await generateText({
      model: openai(MODEL),
      prompt: "Respond with 'OK' if you can read this message.",
      maxTokens: 5,
    })

    if (text.includes("OK")) {
      return {
        success: true,
        model: MODEL,
      }
    } else {
      return {
        success: false,
        error: "Unexpected response from model",
      }
    }
  } catch (error) {
    console.error("Error checking model access:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      success: false,
      error: errorMessage,
    }
  }
}
