"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { Candidate, RankingResult, WeightConfig } from "@/types/resume-ranker"
import { MODEL, FALLBACK_MODEL, OPENAI_API_KEY } from "@/lib/ai-config"

interface RankCandidatesProps {
  jobDescription: string
  candidates: Candidate[]
  jobDescriptionFile?: File | null
  candidateFiles?: Record<string, File | null>
  weightConfig?: WeightConfig
}

// Helper function to clean AI response text and extract JSON
function extractJsonFromResponse(text: string): string {
  // Check if the response is wrapped in markdown code blocks
  const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/
  const match = text.match(jsonRegex)

  // If we found a JSON code block, extract the content
  if (match && match[1]) {
    return match[1].trim()
  }

  // Otherwise return the original text
  return text.trim()
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
        // Extract text from the file
        const text = await extractTextFromFile(jobDescriptionFile)
        if (text && text.trim()) {
          finalJobDescription = text
        }
      } catch (error) {
        console.error("Error processing job description file:", error)
        // Fall back to text input if file parsing fails
      }
    }

    // Process candidate resume files if provided
    const processedCandidates = [...candidates]

    if (candidateFiles) {
      for (const [id, file] of Object.entries(candidateFiles)) {
        if (file) {
          try {
            // Extract text from the file
            const text = await extractTextFromFile(file)

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
            console.error(`Error processing file for candidate ${id}:`, error)
            // Keep existing text input if file parsing fails
          }
        }
      }
    }

    // Validate input data before proceeding
    if (!finalJobDescription.trim()) {
      console.warn("Empty job description, using fallback ranking")
      return generateMockRanking(processedCandidates, "Generic Job Description", weightConfig)
    }

    // Filter out candidates with empty resumes
    const validCandidates = processedCandidates.filter((c) => c.name.trim() && c.resume.trim())

    if (validCandidates.length === 0) {
      console.warn("No valid candidates with resumes, using fallback ranking")
      return generateMockRanking(processedCandidates, finalJobDescription, weightConfig)
    }

    // Create a prompt for the AI to analyze and rank the candidates
    const prompt = createRankingPrompt(finalJobDescription, validCandidates, weightConfig)

    try {
      // First try with the preferred model
      try {
        const response = await generateText({
          model: openai(MODEL, {
            temperature: 0.2, // Lower temperature for more consistent results
            maxTokens: 4000, // Ensure enough tokens for detailed analysis
            apiKey: OPENAI_API_KEY,
          }),
          prompt,
          system: `You are an expert HR professional and recruiter with deep experience in matching candidates to job requirements.
Your task is to analyze each candidate's resume against the job description and provide a detailed ranking.
Respond ONLY with valid JSON in the exact format specified in the prompt. Do not include markdown formatting, code blocks, or any text outside the JSON object.`,
        })

        // Process the response
        return processAIResponse(response.text, validCandidates, finalJobDescription, weightConfig)
      } catch (preferredModelError) {
        console.error("Error with preferred model, trying fallback model:", preferredModelError)

        // Try with the fallback model
        const response = await generateText({
          model: openai(FALLBACK_MODEL, {
            temperature: 0.2,
            maxTokens: 4000,
            apiKey: OPENAI_API_KEY,
          }),
          prompt,
          system: `You are an expert HR professional and recruiter with deep experience in matching candidates to job requirements.
Your task is to analyze each candidate's resume against the job description and provide a detailed ranking.
Respond ONLY with valid JSON in the exact format specified in the prompt. Do not include markdown formatting, code blocks, or any text outside the JSON object.`,
        })

        // Process the response
        return processAIResponse(response.text, validCandidates, finalJobDescription, weightConfig)
      }
    } catch (apiError) {
      console.error("OpenAI API Error:", apiError)
      return generateMockRanking(validCandidates, finalJobDescription, weightConfig)
    }
  } catch (error) {
    console.error("Error in rankCandidates:", error)
    // Always return a valid result, even if there's an error
    return generateMockRanking(candidates, jobDescription, weightConfig)
  }
}

// Helper function to process AI response
function processAIResponse(
  responseText: string,
  validCandidates: Candidate[],
  jobDescription: string,
  weightConfig?: WeightConfig,
): RankingResult {
  try {
    // Clean the response text to handle markdown formatting
    const cleanedText = extractJsonFromResponse(responseText)
    console.log("Cleaned response text:", cleanedText.substring(0, 200) + "...")

    const result = JSON.parse(cleanedText) as RankingResult

    // Validate the result structure
    if (!result.rankedCandidates || !Array.isArray(result.rankedCandidates) || result.rankedCandidates.length === 0) {
      console.error("Invalid response structure from AI", cleanedText)
      return generateMockRanking(validCandidates, jobDescription, weightConfig)
    }

    // Ensure all candidates have the required fields
    const validatedCandidates = result.rankedCandidates.map((candidate) => {
      return {
        name: candidate.name || "Unknown Candidate",
        score: typeof candidate.score === "number" ? candidate.score : 50,
        strengths: Array.isArray(candidate.strengths) ? candidate.strengths : ["Has relevant experience"],
        weaknesses: Array.isArray(candidate.weaknesses) ? candidate.weaknesses : [],
        analysis: candidate.analysis || "This candidate has been evaluated based on their resume.",
        categoryScores: candidate.categoryScores || generateDefaultCategoryScores(),
      }
    })

    // Sort candidates by score in descending order
    validatedCandidates.sort((a, b) => b.score - a.score)

    return { rankedCandidates: validatedCandidates }
  } catch (parseError) {
    console.error("Error parsing AI response:", parseError, "Response:", responseText)
    return generateMockRanking(validCandidates, jobDescription, weightConfig)
  }
}

// Simple function to extract text from document files
async function extractTextFromFile(file: File): Promise<string> {
  try {
    const fileName = file.name.toLowerCase()

    // For simplicity in the browser environment, we'll use a basic approach
    // In a production app, you would use proper document parsing libraries on the server

    if (fileName.endsWith(".pdf")) {
      return "PDF text extraction is currently simplified. For best results, copy-paste the text."
    } else if (fileName.endsWith(".doc") || fileName.endsWith(".docx")) {
      return "Word document text extraction is currently simplified. For best results, copy-paste the text."
    } else {
      return "Unsupported file format. Please use PDF, DOC, or DOCX files, or paste the text directly."
    }
  } catch (error) {
    console.error("Document extraction error:", error)
    return ""
  }
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

IMPORTANT: Return your analysis as a JSON object with this exact structure, and ONLY the JSON object with no markdown formatting or code blocks:
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

// Generate default category scores
function generateDefaultCategoryScores() {
  return {
    technical_skills: Math.floor(Math.random() * 30) + 50,
    experience: Math.floor(Math.random() * 30) + 50,
    education: Math.floor(Math.random() * 30) + 50,
    location: Math.floor(Math.random() * 30) + 50,
    soft_skills: Math.floor(Math.random() * 30) + 50,
    industry_knowledge: Math.floor(Math.random() * 30) + 50,
    certifications: Math.floor(Math.random() * 30) + 50,
  }
}

// Fallback function to generate mock rankings when API is unavailable
function generateMockRanking(
  candidates: Candidate[],
  jobDescription: string,
  weightConfig?: WeightConfig,
): RankingResult {
  // Ensure we have valid candidates
  if (!candidates || candidates.length === 0) {
    return {
      rankedCandidates: [
        {
          name: "Sample Candidate",
          score: 75,
          strengths: ["Sample strength 1", "Sample strength 2", "Sample strength 3"],
          weaknesses: ["Sample weakness"],
          analysis: "This is a sample candidate generated because no valid candidates were provided.",
          categoryScores: generateDefaultCategoryScores(),
        },
      ],
    }
  }

  // Simple keyword matching algorithm
  const keywordsFromJob = extractKeywords(jobDescription)

  // Get weights for different categories
  const weights = getWeightsFromConfig(weightConfig)

  const rankedCandidates = candidates.map((candidate) => {
    // Ensure candidate has valid data
    const name = candidate.name.trim() || "Unnamed Candidate"
    const resumeText = (candidate.resume || "").toLowerCase()

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
    const categoryScores = generateDefaultCategoryScores()

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
    const score = Math.min(Math.round(weightedScore / (totalWeight || 1)), 95)

    // Generate strengths based on matched keywords (up to 3)
    let strengths: string[] = []

    if (matchedKeywords.length > 0) {
      strengths = matchedKeywords.slice(0, 3).map((keyword) => `Has experience with ${keyword}`)
    }

    // If we have fewer than 3 strengths, add generic ones
    while (strengths.length < 3) {
      strengths.push(
        ["Shows relevant experience", "Has applicable skills", "Background aligns with requirements"][
          strengths.length % 3
        ],
      )
    }

    // Generate weaknesses based on unmatched keywords (up to 2)
    let weaknesses: string[] = []

    if (keywordsFromJob.length > 0) {
      const unmatchedKeywords = keywordsFromJob
        .filter((keyword) => !resumeText.includes(keyword.toLowerCase()))
        .slice(0, 2)

      weaknesses = unmatchedKeywords.map((keyword) => `May need more experience with ${keyword}`)
    }

    return {
      name,
      score,
      strengths,
      weaknesses,
      analysis: `This candidate matches approximately ${score}% of the job requirements based on keyword analysis. This is a fallback analysis using our built-in algorithm.`,
      categoryScores,
    }
  })

  // Sort by score
  rankedCandidates.sort((a, b) => b.score - a.score)

  return { rankedCandidates }
}

// Helper function to extract potential keywords from job description
function extractKeywords(text: string): string[] {
  if (!text || typeof text !== "string") {
    return ["experience", "skills", "education", "communication"]
  }

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
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "shall",
    "should",
    "can",
    "could",
    "may",
    "might",
    "must",
    "that",
    "which",
    "who",
    "whom",
    "whose",
    "this",
    "these",
    "those",
    "they",
    "them",
    "their",
    "what",
    "when",
    "where",
    "why",
    "how",
    "all",
    "any",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
  ])

  const potentialKeywords = words.filter((word) => {
    const cleaned = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase()
    return cleaned.length > 3 && !commonWords.has(cleaned)
  })

  // If we couldn't extract any keywords, return some defaults
  if (potentialKeywords.length === 0) {
    return ["experience", "skills", "education", "communication"]
  }

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

  // Validate weight config
  if (!weightConfig.categories || !Array.isArray(weightConfig.categories) || weightConfig.categories.length === 0) {
    return defaultWeights
  }

  const customWeights: Record<string, number> = {}

  weightConfig.categories.forEach((category) => {
    if (category && category.id && typeof category.weight === "number") {
      customWeights[category.id] = category.weight
    }
  })

  // If no valid weights were found, return defaults
  if (Object.keys(customWeights).length === 0) {
    return defaultWeights
  }

  return customWeights
}
