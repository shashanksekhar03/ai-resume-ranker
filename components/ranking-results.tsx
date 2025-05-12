import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RankingResult, RankedCandidate } from "@/types/resume-ranker"
import { Progress } from "@/components/ui/progress"

interface RankingResultsProps {
  results: RankingResult
}

export function RankingResults({ results }: RankingResultsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Ranking Results</h2>

      <div className="space-y-4">
        {results.rankedCandidates.map((candidate, index) => (
          <CandidateCard key={index} candidate={candidate} rank={index + 1} />
        ))}
      </div>
    </div>
  )
}

interface CandidateCardProps {
  candidate: RankedCandidate
  rank: number
}

function CandidateCard({ candidate, rank }: CandidateCardProps) {
  const isFallback = isFallbackAnalysis(candidate.analysis)
  const categoryScores = candidate.categoryScores || {}

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
              {rank}. {candidate.name}
            </CardTitle>
            <div className="mt-1 flex items-center">
              <div className="text-sm font-medium text-green-600">Match Score: {candidate.score}%</div>
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
                    <Progress value={score} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Strengths</h3>
            <ul className="list-disc pl-5 space-y-1">
              {candidate.strengths.map((strength, i) => (
                <li key={i} className="text-sm">
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          {candidate.weaknesses.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Areas for Improvement</h3>
              <ul className="list-disc pl-5 space-y-1">
                {candidate.weaknesses.map((weakness, i) => (
                  <li key={i} className="text-sm">
                    {weakness}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Analysis</h3>
            <p className="text-sm">{candidate.analysis}</p>
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
  return analysis.includes("fallback analysis") || analysis.includes("API quota")
}
