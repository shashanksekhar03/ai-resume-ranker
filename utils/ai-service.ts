/**
 * AI service that works with the OpenAI API
 * This provides a consistent interface for AI operations
 */

import { OPENAI_API_KEY, MODEL, FALLBACK_MODEL } from "@/lib/ai-config"
import { isProduction, isPreview } from "@/utils/environment-detector"

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
    // This is critical for production vs preview consistency
    if (modelName === "gpt-4o") {
      modelName = "gpt-4o" // Ensure exact format
    } else if (modelName !== FALLBACK_MODEL) {
      modelName = FALLBACK_MODEL
    }

    // In production, always use the fallback model first to ensure reliability
    if (isProduction() && !isPreview()) {
      console.log(`Production environment detected, using ${FALLBACK_MODEL} for reliability`)
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

      // Production-specific headers and options
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      }

      // Add production-specific headers
      if (isProduction() && !isPreview()) {
        headers["User-Agent"] = "AI-Resume-Ranker-Production/1.0"
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers,
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

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: "Failed to parse error response" } }))
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

      // Production-specific response handling
      if (isProduction() && !isPreview()) {
        try {
          // For production, use a more robust response parsing approach
          const responseText = await response.text()

          // Try to parse the response as JSON
          let data
          try {
            data = JSON.parse(responseText)
          } catch (jsonError) {
            console.error("Failed to parse JSON response:", jsonError, "Response text:", responseText)

            // Try to extract JSON from the response text
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              try {
                data = JSON.parse(jsonMatch[0])
              } catch (extractError) {
                console.error("Failed to extract JSON from response:", extractError)
                throw new Error("Failed to parse response from OpenAI API")
              }
            } else {
              throw new Error("Failed to parse response from OpenAI API")
            }
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

            // If we can't extract content, return a fallback response
            return {
              text: `{"rankedCandidates":[{"name":"Fallback Ranking","score":50,"strengths":["This is a fallback ranking due to API issues"],"weaknesses":["Unable to perform detailed analysis"],"analysis":"The AI service encountered an error: Missing message content in response. Using built-in ranking algorithm instead."}]}`,
              usedFallback: true,
            }
          }

          return {
            text: data.choices[0]?.message?.content || "",
            usedFallback: modelName !== MODEL,
          }
        } catch (parseError) {
          console.error("Error parsing response in production:", parseError)
          return generateTextWithFallbackModel(options)
        }
      } else {
        // Preview environment - use the original approach
        const data = await response.json()

        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error("Invalid response format from OpenAI API")
        }

        return {
          text: data.choices[0]?.message?.content || "",
          usedFallback: modelName !== MODEL,
        }
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

    // In production, return a valid JSON response even if everything fails
    if (isProduction() && !isPreview()) {
      return {
        text: `{"rankedCandidates":[{"name":"Fallback Ranking","score":50,"strengths":["This is a fallback ranking due to API issues"],"weaknesses":["Unable to perform detailed analysis"],"analysis":"The AI service encountered an error: ${error instanceof Error ? error.message : String(error)}. Using built-in ranking algorithm instead."}]}`,
        error: error instanceof Error ? error.message : String(error),
        usedFallback: true,
      }
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

      // Production-specific headers and options
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      }

      // Add production-specific headers
      if (isProduction() && !isPreview()) {
        headers["User-Agent"] = "AI-Resume-Ranker-Production/1.0"
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers,
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

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: "Failed to parse error response" } }))
        console.error("Fallback model API error:", errorData)
        throw new Error(`Fallback model API error: ${errorData.error?.message || "Unknown error"}`)
      }

      // Production-specific response handling
      if (isProduction() && !isPreview()) {
        try {
          // For production, use a more robust response parsing approach
          const responseText = await response.text()

          // Try to parse the response as JSON
          let data
          try {
            data = JSON.parse(responseText)
          } catch (jsonError) {
            console.error("Failed to parse JSON response:", jsonError, "Response text:", responseText)

            // Try to extract JSON from the response text
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              try {
                data = JSON.parse(jsonMatch[0])
              } catch (extractError) {
                console.error("Failed to extract JSON from response:", extractError)
                throw new Error("Failed to parse response from fallback model")
              }
            } else {
              throw new Error("Failed to parse response from fallback model")
            }
          }

          // Validate the response structure
          if (!data || !data.choices || !data.choices[0]) {
            console.error("Invalid response structure from fallback model:", data)
            throw new Error("Invalid response format from fallback model")
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

            // If we can't extract content, return a fallback response
            return {
              text: `{"rankedCandidates":[{"name":"Fallback Ranking","score":50,"strengths":["This is a fallback ranking due to API issues"],"weaknesses":["Unable to perform detailed analysis"],"analysis":"The AI service encountered an error: Missing message content in fallback response. Using built-in ranking algorithm instead."}]}`,
              usedFallback: true,
            }
          }

          return {
            text: data.choices[0]?.message?.content || "",
            usedFallback: true,
          }
        } catch (parseError) {
          console.error("Error parsing fallback response in production:", parseError)
          // Return a valid JSON response even if parsing fails
          return {
            text: `{"rankedCandidates":[{"name":"Fallback Ranking","score":50,"strengths":["This is a fallback ranking due to API issues"],"weaknesses":["Unable to perform detailed analysis"],"analysis":"The AI service encountered an error while parsing the fallback model response. Using built-in ranking algorithm instead."}]}`,
            usedFallback: true,
          }
        }
      } else {
        // Preview environment - use the original approach
        const data = await response.json()

        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error("Invalid response format from fallback model")
        }

        return {
          text: data.choices[0]?.message?.content || "",
          usedFallback: true,
        }
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)
      throw fetchError
    }
  } catch (error) {
    console.error("Error in fallback model:", error)

    // In production, return a valid JSON response even if everything fails
    if (isProduction() && !isPreview()) {
      return {
        text: `{"rankedCandidates":[{"name":"Fallback Ranking","score":50,"strengths":["This is a fallback ranking due to API issues"],"weaknesses":["Unable to perform detailed analysis"],"analysis":"The AI service encountered an error with the fallback model: ${error instanceof Error ? error.message : String(error)}. Using built-in ranking algorithm instead."}]}`,
        error: error instanceof Error ? error.message : String(error),
        usedFallback: true,
      }
    }

    return {
      text: `Error with fallback model: ${error instanceof Error ? error.message : String(error)}. Using built-in ranking algorithm.`,
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
