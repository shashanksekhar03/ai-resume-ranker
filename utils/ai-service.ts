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

/**
 * Generate text using the OpenAI API directly
 */
export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  try {
    // Extract model name from the model parameter
    let modelName = options.model
    if (typeof modelName === "object" && modelName !== null) {
      // If it's an object (from openai() function), try to extract the model name
      modelName = MODEL
    }

    // Ensure we're using the exact model name format required by OpenAI
    if (modelName === "gpt-4o") {
      modelName = "gpt-4o" // Ensure exact format
    } else if (modelName !== FALLBACK_MODEL) {
      modelName = FALLBACK_MODEL
    }

    console.log(`Attempting to use model: ${modelName}`)

    // Make a direct request to OpenAI API
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

    try {
      // Ensure we're using the correct API key
      const apiKey = OPENAI_API_KEY || process.env.OPENAI_API_KEY

      if (!apiKey) {
        throw new Error("OpenAI API key is missing")
      }

      // Use a try-catch block specifically for the fetch operation
      let response
      try {
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
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
          signal: controller.signal,
        })
      } catch (fetchError) {
        console.error("Fetch operation failed:", fetchError)
        throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
      }

      clearTimeout(timeoutId)

      // Check if response exists and is valid
      if (!response) {
        throw new Error("No response received from OpenAI API")
      }

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (jsonError) {
          // If we can't parse the error as JSON, use the status text
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
        }

        console.error("OpenAI API error:", errorData)

        // Check for specific error messages related to model access
        const errorMessage = errorData.error?.message || "Unknown error"

        if (
          errorMessage.includes("does not exist") ||
          errorMessage.includes("not available") ||
          errorMessage.includes("access to") ||
          errorMessage.includes("permission")
        ) {
          console.log(`Model ${modelName} not available, falling back to ${FALLBACK_MODEL}`)
          return generateTextWithFallbackModel(options)
        }

        // If we're using the preferred model and get an error, try the fallback model
        if (modelName === MODEL) {
          console.log(`Falling back to ${FALLBACK_MODEL} due to API error`)
          return generateTextWithFallbackModel(options)
        }

        throw new Error(`OpenAI API error: ${errorMessage}`)
      }

      // Parse the response with error handling
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError)
        throw new Error("Failed to parse JSON response from OpenAI API")
      }

      // Validate the response structure
      if (!data || !data.choices || !data.choices[0]) {
        console.error("Invalid response structure:", data)
        throw new Error("Invalid response format from OpenAI API")
      }

      // Handle missing message in response
      if (!data.choices[0].message) {
        console.error("Missing message in response:", data.choices[0])

        // Try to extract content from other fields if available
        let extractedContent = ""

        if (data.choices[0].text) {
          extractedContent = data.choices[0].text
        } else if (data.choices[0].delta && data.choices[0].delta.content) {
          extractedContent = data.choices[0].delta.content
        }

        if (extractedContent) {
          return {
            text: extractedContent,
            usedFallback: modelName !== MODEL,
          }
        }

        // If we can't extract content, fall back
        if (modelName === MODEL) {
          console.log("Response missing message field, falling back to alternative model")
          return generateTextWithFallbackModel(options)
        }

        throw new Error("Invalid response format: missing message content")
      }

      return {
        text: data.choices[0]?.message?.content || "",
        usedFallback: modelName !== MODEL,
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)
      throw fetchError
    }
  } catch (error) {
    console.error("Error in generateText:", error)

    // If we haven't tried the fallback model yet, try it now
    if (!options.model.includes(FALLBACK_MODEL)) {
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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

    try {
      // Ensure we're using the correct API key
      const apiKey = OPENAI_API_KEY || process.env.OPENAI_API_KEY

      if (!apiKey) {
        throw new Error("OpenAI API key is missing")
      }

      // Use a try-catch block specifically for the fetch operation
      let response
      try {
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
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
          signal: controller.signal,
        })
      } catch (fetchError) {
        console.error("Fallback fetch operation failed:", fetchError)
        throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
      }

      clearTimeout(timeoutId)

      // Check if response exists and is valid
      if (!response) {
        throw new Error("No response received from fallback model API")
      }

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (jsonError) {
          // If we can't parse the error as JSON, use the status text
          throw new Error(`Fallback model API error: ${response.status} ${response.statusText}`)
        }

        console.error("Fallback model API error:", errorData)
        throw new Error(`Fallback model API error: ${errorData.error?.message || "Unknown error"}`)
      }

      // Parse the response with error handling
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error("Failed to parse JSON response from fallback model:", jsonError)
        throw new Error("Failed to parse JSON response from fallback model")
      }

      // Validate the response structure with more detailed logging
      if (!data) {
        console.error("Empty data from fallback model")
        throw new Error("Empty response from fallback model")
      }

      if (!data.choices) {
        console.error("Missing choices in fallback model response:", data)
        throw new Error("Invalid response format: missing choices")
      }

      if (!data.choices[0]) {
        console.error("Empty choices array in fallback model response:", data.choices)
        throw new Error("Invalid response format: empty choices array")
      }

      // Handle missing message in response
      if (!data.choices[0].message) {
        console.error("Missing message in fallback response:", data.choices[0])

        // Try to extract content from other fields if available
        let extractedContent = ""

        if (data.choices[0].text) {
          extractedContent = data.choices[0].text
        } else if (data.choices[0].delta && data.choices[0].delta.content) {
          extractedContent = data.choices[0].delta.content
        }

        if (extractedContent) {
          return {
            text: extractedContent,
            usedFallback: true,
          }
        }

        throw new Error("Invalid fallback response format: missing message content")
      }

      return {
        text: data.choices[0]?.message?.content || "",
        usedFallback: true,
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)
      throw fetchError
    }
  } catch (error) {
    console.error("Error in fallback model:", error)

    // Return a valid result even if the fallback fails
    return {
      text: `{"rankedCandidates":[{"name":"Fallback Ranking","score":50,"strengths":["This is a fallback ranking due to API issues"],"weaknesses":["Unable to perform detailed analysis"],"analysis":"The AI service encountered an error: ${error instanceof Error ? error.message : String(error)}. Using built-in ranking algorithm instead."}]}`,
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
  // Ensure we're returning the exact model string format
  if (model === "gpt-4o") {
    return "gpt-4o"
  }
  return model
}

/**
 * Check if the AI SDK is available
 */
export function isAiSdkAvailable(): boolean {
  try {
    // Try to import the AI SDK
    require("ai")
    require("@ai-sdk/openai")
    return true
  } catch (error) {
    return false
  }
}
