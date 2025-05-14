/**
 * AI service that works with the OpenAI API
 * This provides a consistent interface for AI operations
 */

import { OPENAI_API_KEY, MODEL, FALLBACK_MODEL } from "@/lib/ai-config"

interface GenerateTextOptions {
  model: string
  prompt: string
  system?: string
  temperature?: number
  maxTokens?: number
}

interface GenerateTextResult {
  text: string
  error?: string
  usedFallback?: boolean
}

// Maximum number of retries for API calls
const MAX_RETRIES = 2
// Timeout for API calls in milliseconds (20 seconds)
const API_TIMEOUT = 20000

/**
 * Generate text using the OpenAI API directly
 */
export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  // Don't force fallback - try the API in all environments
  const useDirectFallback = false

  if (useDirectFallback) {
    console.log("Using direct fallback to built-in ranking algorithm")
    return {
      text: "FALLBACK_RANKING_REQUIRED",
      error: "Using built-in ranking algorithm for stability",
      usedFallback: true,
    }
  }

  try {
    // Extract model name from the model parameter
    let modelName = options.model
    if (typeof modelName === "object" && modelName !== null) {
      // If it's an object (from openai() function), try to extract the model name
      modelName = MODEL // Use the preferred model (gpt-4o)
    }

    // Fallback to a simpler model if needed
    if (modelName !== MODEL && modelName !== FALLBACK_MODEL) {
      modelName = MODEL // Use the preferred model (gpt-4o)
    }

    console.log(`Attempting to use model: ${modelName}`)

    // Create an AbortController for the timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

    try {
      // Make a direct request to OpenAI API with timeout
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            ...(options.system ? [{ role: "system", content: options.system }] : []),
            { role: "user", content: options.prompt },
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1500, // Reduced for stability
        }),
        signal: controller.signal,
      })

      // Clear the timeout
      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = `HTTP error ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error?.message || errorMessage
        } catch (e) {
          // Ignore JSON parsing errors in error responses
        }

        console.error("OpenAI API error:", errorMessage)

        // Signal that we need to use the fallback
        return {
          text: "FALLBACK_RANKING_REQUIRED",
          error: `API error: ${errorMessage}`,
          usedFallback: true,
        }
      }

      let data
      try {
        data = await response.json()
      } catch (e) {
        console.error("Failed to parse JSON response:", e)
        return {
          text: "FALLBACK_RANKING_REQUIRED",
          error: "Failed to parse API response",
          usedFallback: true,
        }
      }

      if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Invalid response format:", data)
        return {
          text: "FALLBACK_RANKING_REQUIRED",
          error: "Invalid response format from API",
          usedFallback: true,
        }
      }

      return {
        text: data.choices[0]?.message?.content || "",
        usedFallback: modelName !== MODEL,
      }
    } catch (fetchError) {
      // Clear the timeout if it's an abort error
      clearTimeout(timeoutId)

      if (fetchError.name === "AbortError") {
        console.error("Request timed out after", API_TIMEOUT, "ms")
        return {
          text: "FALLBACK_RANKING_REQUIRED",
          error: "Request timed out",
          usedFallback: true,
        }
      }

      throw fetchError
    }
  } catch (error) {
    console.error("Error in generateText:", error)

    return {
      text: "FALLBACK_RANKING_REQUIRED",
      error: error instanceof Error ? error.message : String(error),
      usedFallback: true,
    }
  }
}

/**
 * Mock function for openai model configuration
 * This mimics the behavior of the AI SDK's openai function
 */
export function openai(model: string, options?: any): string {
  return model
}

/**
 * Check if the AI SDK is available
 */
export function isAiSdkAvailable(): boolean {
  return false // Always return false for stability
}
