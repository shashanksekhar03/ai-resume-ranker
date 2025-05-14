"use server"

import { MODEL, FALLBACK_MODEL, OPENAI_API_KEY } from "@/lib/ai-config"
import { generateText, openai } from "@/utils/ai-service"

interface ModelAccessResult {
  success: boolean
  model?: string
  error?: string
  details?: string
}

export async function checkModelAccess(): Promise<ModelAccessResult> {
  try {
    console.log("Checking model access...")

    // Try to use the model with our fallback service
    try {
      console.log(`Testing access to ${FALLBACK_MODEL}...`)
      const { text, usedFallback } = await generateText({
        model: openai(FALLBACK_MODEL, {
          apiKey: OPENAI_API_KEY,
        }),
        prompt: "Respond with 'OK' if you can read this message.",
        temperature: 0.1,
        maxTokens: 10,
      })

      console.log(`Response from ${FALLBACK_MODEL}: "${text}"`)

      if (text.toLowerCase().includes("ok")) {
        // If basic model works, try the advanced model
        try {
          console.log(`Testing access to ${MODEL}...`)
          const advancedResponse = await generateText({
            model: openai(MODEL, {
              apiKey: OPENAI_API_KEY,
            }),
            prompt: "Respond with 'OK' if you can read this message.",
            temperature: 0.1,
            maxTokens: 10,
          })

          console.log(`Response from ${MODEL}: "${advancedResponse.text}"`)

          if (advancedResponse.text.toLowerCase().includes("ok")) {
            return {
              success: true,
              model: MODEL,
              details: `Successfully connected to ${MODEL}`,
            }
          } else {
            return {
              success: false,
              model: FALLBACK_MODEL,
              error: `Your API key works, but ${MODEL} returned an unexpected response. Using ${FALLBACK_MODEL} instead.`,
              details: `Response: "${advancedResponse.text}"`,
            }
          }
        } catch (advancedModelError) {
          console.error("Error accessing advanced model:", advancedModelError)
          return {
            success: false,
            model: FALLBACK_MODEL,
            error: `Your API key works, but doesn't have access to ${MODEL}. Using ${FALLBACK_MODEL} instead.`,
            details: advancedModelError instanceof Error ? advancedModelError.message : String(advancedModelError),
          }
        }
      } else {
        return {
          success: false,
          error: `Unexpected response from ${FALLBACK_MODEL}`,
          details: `Response: "${text}"`,
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
        details: JSON.stringify(modelError),
      }
    }
  } catch (error) {
    console.error("Error checking model access:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      success: false,
      error: errorMessage,
      details: "An unexpected error occurred while checking model access.",
    }
  }
}
