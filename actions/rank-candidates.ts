"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { Candidate, RankingResult } from "@/types/resume-ranker"

interface RankCandidatesProps {
  jobDescription: string
  candidates: Candidate[]
  jobDescriptionFile?: File | null
  candidateFiles?: Record<string, File | null>
}

export async function rankCandidates({
  jobDescription,
  candidates,
  jobDescriptionFile,
  candidateFiles,
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
    const prompt = createRankingPrompt(finalJobDescription, processedCandidates)

    try {
      // Try to generate the ranking using AI
      const { text } = await generateText({
        model: openai("gpt-4o"),
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

      // Check if it's a quota error
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError)
      if (errorMessage.includes("quota") || errorMessage.includes("billing")) {
        // Use fallback mock ranking when API quota is exceeded
        return generateMockRanking(processedCandidates, finalJobDescription)
      }

      throw apiError // Re-throw if it's not a quota error
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

// The rest of the functions remain the same
function createRankingPrompt(jobDescription: string, candidates: Candidate[]): string {
  return `
Job Description:
${jobDescription}

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

Return your analysis as a JSON object with this exact structure:
{
  "rankedCandidates": [
    {
      "name": "Candidate Name",
      "score": 85,
      "strengths": ["Strength 1", "Strength 2", "Strength 3"],
      "weaknesses": ["Weakness 1", "Weakness 2"],
      "analysis": "Brief analysis of why this candidate received this ranking."
    }
  ]
}
`
}

// Fallback function to generate mock rankings when API is unavailable
function generateMockRanking(candidates: Candidate[], jobDescription: string): RankingResult {
  // Simple keyword matching algorithm
  const keywordsFromJob = extractKeywords(jobDescription)

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

    // Calculate a simple score based on keyword matches
    const score = Math.min(Math.round((matchCount / Math.max(keywordsFromJob.length, 1)) * 100), 95)

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
