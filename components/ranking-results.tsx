"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RankingResult, RankedCandidate } from "@/types/resume-ranker"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface RankingResultsProps {
  results: RankingResult
}

export function RankingResults({ results }: RankingResultsProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const candidatesPerPage = 5

  // Validate results
  if (
    !results ||
    !results.rankedCandidates ||
    !Array.isArray(results.rankedCandidates) ||
    results.rankedCandidates.length === 0
  ) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center">No Results Available</h2>
        <p className="text-center text-gray-500">No ranking results are available. Please try again.</p>
      </div>
    )
  }

  // Calculate pagination
  const totalCandidates = results.rankedCandidates.length
  const totalPages = Math.ceil(totalCandidates / candidatesPerPage)

  // Get current page candidates
  const indexOfLastCandidate = currentPage * candidatesPerPage
  const indexOfFirstCandidate = indexOfLastCandidate - candidatesPerPage
  const currentCandidates = results.rankedCandidates.slice(indexOfFirstCandidate, indexOfLastCandidate)

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)
  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Ranking Results</h2>
        {totalCandidates > candidatesPerPage && (
          <div className="text-sm text-gray-500">
            Showing {indexOfFirstCandidate + 1}-{Math.min(indexOfLastCandidate, totalCandidates)} of {totalCandidates}{" "}
            candidates
          </div>
        )}
      </div>

      <div className="space-y-4">
        {currentCandidates.map((candidate, index) => (
          <CandidateCard key={index} candidate={candidate} rank={indexOfFirstCandidate + index + 1} />
        ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          <Button variant="outline" size="sm" onClick={prevPage} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="flex items-center space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
              <Button
                key={number}
                variant={currentPage === number ? "default" : "outline"}
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => paginate(number)}
              >
                {number}
              </Button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={nextPage} disabled={currentPage === totalPages}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}

interface CandidateCardProps {
  candidate: RankedCandidate
  rank: number
}

function CandidateCard({ candidate, rank }: CandidateCardProps) {
  // Validate candidate data
  const name = candidate.name || "Unnamed Candidate"
  const score = typeof candidate.score === "number" ? candidate.score : 0
  const strengths = Array.isArray(candidate.strengths) ? candidate.strengths : []
  const weaknesses = Array.isArray(candidate.weaknesses) ? candidate.weaknesses : []
  const analysis = candidate.analysis || "No analysis available"
  const categoryScores = candidate.categoryScores || {}

  const isFallback = isFallbackAnalysis(analysis)

  // Map of category IDs to readable names
  const categoryNames: Record<string, string> = {
    technical_skills: "Technical Skills",
    experience: "Experience",
    education: "Education",
    location: "Location",
    soft_skills: "Soft Skills",
    industry_knowledge: "Industry Knowledge",
    certifications: "Certifications",
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">
              {rank}. {name}
            </CardTitle>
            <div className="mt-1 flex items-center">
              <div className="text-sm font-medium text-green-600">Match Score: {score}%</div>
              {isFallback && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                  Fallback Ranking
                </span>
              )}
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRankBadgeColor(rank)}`}>
            {getRankLabel(rank)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.keys(categoryScores).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">Category Scores</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(categoryScores).map(([category, score]) => (
                  <div key={category} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium">{categoryNames[category] || category}</span>
                      <span className="text-xs font-medium">{score}%</span>
                    </div>
                    <Progress value={Number(score)} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {strengths.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Strengths</h3>
              <ul className="list-disc pl-5 space-y-1">
                {strengths.map((strength, i) => (
                  <li key={i} className="text-sm">
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {weaknesses.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Areas for Improvement</h3>
              <ul className="list-disc pl-5 space-y-1">
                {weaknesses.map((weakness, i) => (
                  <li key={i} className="text-sm">
                    {weakness}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Analysis</h3>
            <p className="text-sm">{analysis}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getRankBadgeColor(rank: number): string {
  switch (rank) {
    case 1:
      return "bg-green-100 text-green-800"
    case 2:
      return "bg-blue-100 text-blue-800"
    case 3:
      return "bg-purple-100 text-purple-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function getRankLabel(rank: number): string {
  switch (rank) {
    case 1:
      return "Top Match"
    case 2:
      return "Strong Match"
    case 3:
      return "Good Match"
    default:
      return "Potential Match"
  }
}

function isFallbackAnalysis(analysis: string): boolean {
  return (
    analysis.includes("fallback analysis") || analysis.includes("API quota") || analysis.includes("built-in algorithm")
  )
}
