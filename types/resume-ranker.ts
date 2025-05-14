export interface Candidate {
  id: string
  name: string
  resume: string
}

export interface RankedCandidate {
  name: string
  score: number
  strengths: string[]
  weaknesses: string[]
  analysis: string
  categoryScores?: Record<string, number>
}

export interface RankingResult {
  rankedCandidates: RankedCandidate[]
  preprocessStats?: {
    original: number
    processed: number
    percentReduction: number
  }
}

export interface FileUploadProps {
  id: string
  label: string
  accept?: string
  onChange: (file: File | null) => void
  currentFile: File | null
}

export interface WeightCategory {
  id: string
  name: string
  description: string
  weight: number
  defaultWeight: number
  aiSuggested?: boolean
}

export interface WeightConfig {
  categories: WeightCategory[]
  useCustomWeights: boolean
}

export type FileProcessingStatus = "processing" | "success" | "error" | null
