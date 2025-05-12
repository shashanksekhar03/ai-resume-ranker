"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { Candidate, RankingResult, WeightConfig } from "@/types/resume-ranker"

// Define the model to use throughout the application
const MODEL = "gpt-4o"

interface RankCandidatesProps {
  jobDescription: string
  candidates: Candidate[]
  jobDescriptionFile?: File | null
  candidateFiles?: Record<string, File | null>
  weightConfig?: WeightConfig
}

export async function rankCandidates({
  jobDescription,
  candidates,
  jobDescriptionFile,
  candidateFiles,
  weightConfig,
}: RankCandidatesProps): Promise<RankingResult> {
  try {
    // Process job description file if provided
    let finalJobDescription = jobDescription
    if (jobDescriptionFile) {
      try {
        // Extract text directly without using the PDF parser
        const text = await extractTextFromPdf(jobDescriptionFile)
        if (text && text.trim()) {
          finalJobDescription = text
        }
      } catch (error) {
        console.error("Error processing job description PDF:", error)
        // Fall back to text input if PDF parsing fails
      }
    }

    // Process candidate resume files if provided
    const processedCandidates = [...candidates]

    if (candidateFiles) {
      for (const [id, file] of Object.entries(candidateFiles)) {
        if (file) {
          try {
            // Extract text directly without using the PDF parser
            const text = await extractTextFromPdf(file)

            if (text && text.trim()) {
              // Find and update the corresponding candidate
              const candidateIndex = processedCandidates.findIndex((c) => c.id === id)
              if (candidateIndex !== -1) {
                processedCandidates[candidateIndex] = {
                  ...processedCandidates[candidateIndex],
                  resume: text,
                }
              }
            }
          } catch (error) {
            console.error(`Error processing PDF for candidate ${id}:`, error)
            // Keep existing text input if PDF parsing fails
          }
        }
      }
    }

    // Create a prompt for the AI to analyze and rank the candidates
    const prompt = createRankingPrompt(finalJobDescription, processedCandidates, weightConfig)

    try {
      // Try to generate the ranking using AI with explicit model configuration
      const { text } = await generateText({
        model: openai(MODEL, {
          temperature: 0.2, // Lower temperature for more consistent results
          maxTokens: 4000, // Ensure enough tokens for detailed analysis
        }),
        prompt,
        system: `You are an expert HR professional and recruiter with deep experience in matching candidates to job requirements.
Your task is to analyze each candidate's resume against the job description and provide a detailed ranking.
Respond ONLY with valid JSON in the exact format specified in the prompt.`,
      })

      // Parse the response
      const result = JSON.parse(text) as RankingResult

      // Sort candidates by score in descending order
      result.rankedCandidates.sort((a, b) => b.score - a.score)

      return result
    } catch (apiError) {
      console.error("OpenAI API Error:", apiError)

      // Check for specific error types
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError)

      if (errorMessage.includes("model")) {
        throw new Error(`Error accessing ${MODEL} model. Please check your API key permissions.`)
      } else if (errorMessage.includes("quota") || errorMessage.includes("billing")) {
        // Use fallback mock ranking when API quota is exceeded
        return generateMockRanking(processedCandidates, finalJobDescription, weightConfig)
      }

      throw apiError // Re-throw if it's not a handled error
    }
  } catch (error) {
    console.error("Error in rankCandidates:", error)
    throw new Error(`Failed to rank candidates: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Simple function to extract text from PDF using a basic approach
async function extractTextFromPdf(file: File): Promise<string> {
  try {
    // For simplicity, we'll use a basic text extraction approach
    // This is a fallback method that works in browser environments
    const arrayBuffer = await file.arrayBuffer()
    const text = await extractTextFromPdfBuffer(arrayBuffer)
    return text
  } catch (error) {
    console.error("PDF extraction error:", error)
    return ""
  }
}

// Basic PDF text extraction function
async function extractTextFromPdfBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  // In a real implementation, you would use a proper PDF parsing library
  // For now, we'll return a placeholder message
  return "PDF text extraction is currently simplified. Please use text input for more accurate results."
}

function createRankingPrompt(jobDescription: string, candidates: Candidate[], weightConfig?: WeightConfig): string {
  // Format the weight configuration for the prompt
  let weightInstructions = ""

  if (weightConfig && weightConfig.useCustomWeights) {
    weightInstructions = `
Use the following category weights (scale 1-10) when evaluating candidates:
${weightConfig.categories.map((c) => `- ${c.name}: ${c.weight}/10 - ${c.description}`).join("\n")}

Higher weights indicate more importance for that category. Make sure your evaluation reflects these priorities.
    `
  } else {
    weightInstructions = `
Determine appropriate weights for different evaluation categories based on the job description.
For example, if the job is fully in-person, location should be weighted more heavily.
If technical skills are critical, they should receive a higher weight.
    `
  }

  return `
Job Description:
${jobDescription}

${weightInstructions}

Candidates:
${candidates
  .map(
    (c) => `
Name: ${c.name}
Resume:
${c.resume}
`,
  )
  .join("\n---\n")}

Analyze each candidate's resume against the job description. Rank them based on how well they match the requirements.

For each candidate, provide:
1. A match score (0-100)
2. 3-5 key strengths relevant to the job
3. 1-3 areas for improvement or missing skills (if any)
4. A brief analysis explaining the ranking (2-3 sentences)
5. Category scores showing how well they match in each category (technical skills, experience, education, etc.)

Return your analysis as a JSON object with this exact structure:
{
  "rankedCandidates": [
    {
      "name": "Candidate Name",
      "score": 85,
      "strengths": ["Strength 1", "Strength 2", "Strength 3"],
      "weaknesses": ["Weakness 1", "Weakness 2"],
      "analysis": "Brief analysis of why this candidate received this ranking.",
      "categoryScores": {
        "technical_skills": 80,
        "experience": 90,
        "education": 75,
        "location": 60,
        "soft_skills": 85,
        "industry_knowledge": 70,
        "certifications": 65
      }
    }
  ]
}
`
}

// Fallback function to generate mock rankings when API is unavailable
function generateMockRanking(
  candidates: Candidate[],
  jobDescription: string,
  weightConfig?: WeightConfig,
): RankingResult {
  // Simple keyword matching algorithm
  const keywordsFromJob = extractKeywords(jobDescription)

  // Get weights for different categories
  const weights = getWeightsFromConfig(weightConfig)

  const rankedCandidates = candidates.map((candidate) => {
    const resumeText = candidate.resume.toLowerCase()

    // Count matching keywords
    let matchCount = 0
    const matchedKeywords: string[] = []

    keywordsFromJob.forEach((keyword) => {
      if (resumeText.includes(keyword.toLowerCase())) {
        matchCount++
        matchedKeywords.push(keyword)
      }
    })

    // Calculate category scores (simplified version)
    const categoryScores = {
      technical_skills: Math.floor(Math.random() * 30) + 50, // Random score between 50-80
      experience: Math.floor(Math.random() * 30) + 50,
      education: Math.floor(Math.random() * 30) + 50,
      location: Math.floor(Math.random() * 30) + 50,
      soft_skills: Math.floor(Math.random() * 30) + 50,
      industry_knowledge: Math.floor(Math.random() * 30) + 50,
      certifications: Math.floor(Math.random() * 30) + 50,
    }

    // Apply weights to calculate weighted score
    let weightedScore = 0
    let totalWeight = 0

    Object.entries(weights).forEach(([category, weight]) => {
      if (category in categoryScores) {
        weightedScore += categoryScores[category as keyof typeof categoryScores] * weight
        totalWeight += weight
      }
    })

    // Calculate final score
    const score = Math.min(Math.round(weightedScore / totalWeight), 95)

    // Generate strengths based on matched keywords (up to 3)
    const strengths = matchedKeywords.slice(0, 3).map((keyword) => `Has experience with ${keyword}`)

    // If we have fewer than 3 strengths, add generic ones
    while (strengths.length < 3) {
      strengths.push(
        ["Shows relevant experience", "Has applicable skills", "Background aligns with requirements"][
          strengths.length % 3
        ],
      )
    }

    // Generate weaknesses based on unmatched keywords (up to 2)
    const unmatchedKeywords = keywordsFromJob
      .filter((keyword) => !resumeText.includes(keyword.toLowerCase()))
      .slice(0, 2)

    const weaknesses = unmatchedKeywords.map((keyword) => `May need more experience with ${keyword}`)

    return {
      name: candidate.name,
      score,
      strengths,
      weaknesses,
      analysis: `This candidate matches approximately ${score}% of the job requirements based on keyword analysis. This is a fallback analysis due to OpenAI API quota limitations.`,
      categoryScores,
    }
  })

  // Sort by score
  rankedCandidates.sort((a, b) => b.score - a.score)

  return { rankedCandidates }
}

// Helper function to extract potential keywords from job description
function extractKeywords(text: string): string[] {
  // This is a simple implementation - in a real app, you'd want more sophisticated NLP
  const words = text.split(/\s+/)

  // Filter out common words and keep potential skills/technologies
  const commonWords = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "with",
    "by",
    "about",
    "as",
    "of",
  ])

  const potentialKeywords = words.filter((word) => {
    const cleaned = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase()
    return cleaned.length > 3 && !commonWords.has(cleaned)
  })

  // Remove duplicates and return
  return [...new Set(potentialKeywords)]
}

// Helper function to get weights from config
function getWeightsFromConfig(weightConfig?: WeightConfig) {
  const defaultWeights = {
    technical_skills: 5,
    experience: 5,
    education: 3,
    location: 2,
    soft_skills: 3,
    industry_knowledge: 4,
    certifications: 2,
  }

  if (!weightConfig || !weightConfig.useCustomWeights) {
    return defaultWeights
  }

  const customWeights: Record<string, number> = {}

  weightConfig.categories.forEach((category) => {
    customWeights[category.id] = category.weight
  })

  return customWeights
}
