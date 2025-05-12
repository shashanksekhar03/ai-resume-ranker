"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { rankCandidates } from "@/actions/rank-candidates"
import { RankingResults } from "@/components/ranking-results"
import type { Candidate, RankingResult, WeightConfig } from "@/types/resume-ranker"
import { Loader2, AlertCircle } from "lucide-react"
import { FileUpload } from "@/components/file-upload"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { WeightConfigurator } from "@/components/weight-configurator"
import { ModelStatus } from "@/components/model-status"

export function ResumeRanker() {
  const [jobDescription, setJobDescription] = useState("")
  const [candidates, setCandidates] = useState<Candidate[]>([{ id: "1", name: "", resume: "" }])
  const [results, setResults] = useState<RankingResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGeneratingWeights, setIsGeneratingWeights] = useState(false)

  // Weight configuration state
  const [weightConfig, setWeightConfig] = useState<WeightConfig>({
    categories: [],
    useCustomWeights: false,
  })

  // File state
  const [jobDescriptionFile, setJobDescriptionFile] = useState<File | null>(null)
  const [candidateFiles, setCandidateFiles] = useState<Record<string, File | null>>({})

  const addCandidate = () => {
    const newId = Date.now().toString()
    setCandidates([...candidates, { id: newId, name: "", resume: "" }])
    setCandidateFiles({
      ...candidateFiles,
      [newId]: null,
    })
  }

  const removeCandidate = (id: string) => {
    if (candidates.length > 1) {
      setCandidates(candidates.filter((candidate) => candidate.id !== id))

      // Remove the file for this candidate
      const updatedFiles = { ...candidateFiles }
      delete updatedFiles[id]
      setCandidateFiles(updatedFiles)
    }
  }

  const updateCandidate = (id: string, field: "name" | "resume", value: string) => {
    setCandidates(candidates.map((candidate) => (candidate.id === id ? { ...candidate, [field]: value } : candidate)))
  }

  const updateCandidateFile = (id: string, file: File | null) => {
    setCandidateFiles({
      ...candidateFiles,
      [id]: file,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null) // Clear previous errors

    // Validate inputs
    if (!jobDescription.trim() && !jobDescriptionFile) {
      alert("Please enter a job description or upload a PDF")
      return
    }

    const validCandidates = candidates.filter((c) => {
      // A candidate is valid if they have a name AND either resume text OR a PDF file
      return c.name.trim() && (c.resume.trim() || candidateFiles[c.id])
    })

    if (validCandidates.length < 1) {
      alert("Please enter at least one candidate with name and resume (text or PDF)")
      return
    }

    setIsLoading(true)

    try {
      const result = await rankCandidates({
        jobDescription,
        candidates: validCandidates,
        jobDescriptionFile,
        candidateFiles,
        weightConfig,
      })

      setResults(result)
    } catch (error) {
      console.error("Error ranking candidates:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes("quota") || errorMessage.includes("billing")) {
        setError(
          "OpenAI API quota exceeded. The application is using a fallback ranking method. To fix this issue, please check your OpenAI API billing settings at https://platform.openai.com/account/billing",
        )
      } else if (errorMessage.includes("model")) {
        setError(
          "Unable to access GPT-4o model. The application is using a fallback ranking method. Please check your API key permissions.",
        )
      } else {
        setError(`An error occurred: ${errorMessage}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Model Status Check */}
      <ModelStatus />

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              {error.includes("quota") && (
                <p className="mt-2 text-sm text-red-700">
                  The application is using a simplified fallback ranking method. For more accurate results, please
                  update your OpenAI API billing.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <Alert className="mb-6 bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          PDF upload functionality is currently limited in this preview. For best results, please use the text input
          option.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="text">Enter Text</TabsTrigger>
                  <TabsTrigger value="pdf">Upload PDF</TabsTrigger>
                </TabsList>
                <TabsContent value="text">
                  <div>
                    <Label htmlFor="job-description">Job Description</Label>
                    <Textarea
                      id="job-description"
                      placeholder="Paste the job description here..."
                      className="min-h-[200px]"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="pdf">
                  <FileUpload
                    id="job-description-file"
                    label="Upload Job Description PDF"
                    onChange={setJobDescriptionFile}
                    currentFile={jobDescriptionFile}
                  />
                  <p className="text-sm text-amber-600 mt-2">
                    Note: PDF text extraction is simplified in this preview. For best results, copy-paste the text.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        <WeightConfigurator
          jobDescription={jobDescription}
          onWeightsChange={setWeightConfig}
          isGeneratingWeights={isGeneratingWeights}
          setIsGeneratingWeights={setIsGeneratingWeights}
        />

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Candidates</h2>
            <Button type="button" onClick={addCandidate} variant="outline">
              Add Candidate
            </Button>
          </div>

          {candidates.map((candidate, index) => (
            <Card key={candidate.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Candidate {index + 1}</h3>
                    {candidates.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeCandidate(candidate.id)}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={`name-${candidate.id}`}>Name</Label>
                    <Input
                      id={`name-${candidate.id}`}
                      placeholder="Candidate name"
                      value={candidate.name}
                      onChange={(e) => updateCandidate(candidate.id, "name", e.target.value)}
                    />
                  </div>

                  <Tabs defaultValue="text" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="text">Enter Resume Text</TabsTrigger>
                      <TabsTrigger value="pdf">Upload Resume PDF</TabsTrigger>
                    </TabsList>
                    <TabsContent value="text">
                      <div>
                        <Label htmlFor={`resume-${candidate.id}`}>Resume</Label>
                        <Textarea
                          id={`resume-${candidate.id}`}
                          placeholder="Paste the candidate's resume here..."
                          className="min-h-[150px]"
                          value={candidate.resume}
                          onChange={(e) => updateCandidate(candidate.id, "resume", e.target.value)}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="pdf">
                      <FileUpload
                        id={`resume-file-${candidate.id}`}
                        label="Upload Resume PDF"
                        onChange={(file) => updateCandidateFile(candidate.id, file)}
                        currentFile={candidateFiles[candidate.id] || null}
                      />
                      <p className="text-sm text-amber-600 mt-2">
                        Note: PDF text extraction is simplified in this preview. For best results, copy-paste the text.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button type="submit" size="lg" disabled={isLoading || isGeneratingWeights}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ranking Candidates...
              </>
            ) : (
              "Rank Candidates"
            )}
          </Button>
        </div>
      </form>

      {results && !isLoading && (
        <div className="mt-12">
          <RankingResults results={results} />
        </div>
      )}
    </div>
  )
}
