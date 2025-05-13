"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { MODEL, FALLBACK_MODEL, OPENAI_API_KEY } from "@/lib/ai-config"

interface ModelAccessResult {
  success: boolean
  model?: string
  error?: string
}

export async function checkModelAccess(): Promise<ModelAccessResult> {
  try {
    // Try to use the model with the AI SDK
    try {
      const { text } = await generateText({
        model: openai(FALLBACK_MODEL, {
          apiKey: OPENAI_API_KEY,
        }),
        prompt: "Respond with 'OK' if you can read this message.",
      })

      if (text.toLowerCase().includes("ok")) {
        // If basic model works, try the advanced model
        try {
          await generateText({
            model: openai(MODEL, {
              apiKey: OPENAI_API_KEY,
            }),
            prompt: "Test",
          })

          return {
            success: true,
            model: MODEL,
          }
        } catch (advancedModelError) {
          console.error("Error accessing advanced model:", advancedModelError)
          return {
            success: false,
            error: `Your API key works, but doesn't have access to ${MODEL}. Using fallback model instead.`,
          }
        }
      } else {
        return {
          success: false,
          error: "Unexpected response from model",
        }
      }
    } catch (modelError: any) {
      console.error("Error using model:", modelError)

      // Extract the most useful error message
      let errorMessage = "Unknown error occurred"
      if (modelError?.message) {
        errorMessage = modelError.message
      } else if (typeof modelError === "object" && modelError?.error?.message) {
        errorMessage = modelError.error.message
      } else if (typeof modelError === "string") {
        errorMessage = modelError
      }

      return {
        success: false,
        error: `Error using model: ${errorMessage}`,
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
