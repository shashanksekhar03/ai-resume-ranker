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
}

export interface RankingResult {
  rankedCandidates: RankedCandidate[]
}

export interface FileUploadProps {
  id: string
  label: string
  accept?: string
  onChange: (file: File | null) => void
  currentFile: File | null
}
