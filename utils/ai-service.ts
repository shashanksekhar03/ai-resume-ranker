/**
 * AI service that works with the OpenAI API directly
 * This provides a consistent interface for AI operations without external dependencies
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

/**
 * Generate text using the OpenAI API directly
 */
export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  try {
    // Extract model name from the model parameter
    let modelName = typeof options.model === "string" ? options.model : MODEL

    // Fallback to a simpler model if needed
    if (modelName !== MODEL && modelName !== FALLBACK_MODEL) {
      modelName = FALLBACK_MODEL
    }

    console.log(`Attempting to use model: ${modelName}`)

    // Make a direct request to OpenAI API
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
        max_tokens: options.maxTokens || 2000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("OpenAI API error:", errorData)

      // If we're using the preferred model and get an error, try the fallback model
      if (modelName === MODEL) {
        console.log(`Falling back to ${FALLBACK_MODEL} due to API error`)
        return generateTextWithFallbackModel(options)
      }

      throw new Error(`OpenAI API error: ${errorData.error?.message || "Unknown error"}`)
    }

    const data = await response.json()
    return {
      text: data.choices[0]?.message?.content || "",
      usedFallback: modelName !== MODEL,
    }
  } catch (error) {
    console.error("Error in generateText:", error)

    // If we haven't tried the fallback model yet, try it now
    if (options.model !== FALLBACK_MODEL) {
      console.log(`Attempting fallback to ${FALLBACK_MODEL} after error`)
      return generateTextWithFallbackModel(options)
    }

    return {
      text: `Error generating text: ${error instanceof Error ? error.message : String(error)}. Using fallback ranking.`,
      error: error instanceof Error ? error.message : String(error),
      usedFallback: true,
    }
  }
}

/**
 * Try generating text with the fallback model
 */
async function generateTextWithFallbackModel(options: GenerateTextOptions): Promise<GenerateTextResult> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: FALLBACK_MODEL,
        messages: [
          ...(options.system ? [{ role: "system", content: options.system }] : []),
          { role: "user", content: options.prompt },
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Fallback model API error:", errorData)
      throw new Error(`Fallback model API error: ${errorData.error?.message || "Unknown error"}`)
    }

    const data = await response.json()
    return {
      text: data.choices[0]?.message?.content || "",
      usedFallback: true,
    }
  } catch (error) {
    console.error("Error in fallback model:", error)
    return {
      text: `Error with fallback model: ${error instanceof Error ? error.message : String(error)}. Using built-in ranking algorithm.`,
      error: error instanceof Error ? error.message : String(error),
      usedFallback: true,
    }
  }
}

/**
 * Mock function for openai model configuration
 * This mimics the behavior of the AI SDK's openai function but doesn't require the package
 */
export function openai(model: string, options?: any): string {
  return model
}
