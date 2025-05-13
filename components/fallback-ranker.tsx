"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export function FallbackRanker() {
  const [jobDescription, setJobDescription] = useState("")
  const [candidates, setCandidates] = useState([{ id: "1", name: "", resume: "" }])

  const addCandidate = () => {
    setCandidates([...candidates, { id: Date.now().toString(), name: "", resume: "" }])
  }

  const updateCandidate = (id: string, field: "name" | "resume", value: string) => {
    setCandidates(candidates.map((candidate) => (candidate.id === id ? { ...candidate, [field]: value } : candidate)))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert("The ranking feature is currently unavailable. Please try again later.")
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Alert className="mb-6 bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          The AI Resume Ranker is currently running in limited functionality mode. Some features may not be available.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Textarea
                id="job-description"
                placeholder="Paste the job description here..."
                className="min-h-[200px]"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Candidates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {candidates.map((candidate, index) => (
              <div key={candidate.id} className="space-y-4">
                <div>
                  <Label htmlFor={`name-${candidate.id}`}>Candidate {index + 1} Name</Label>
                  <Input
                    id={`name-${candidate.id}`}
                    placeholder="Candidate name"
                    value={candidate.name}
                    onChange={(e) => updateCandidate(candidate.id, "name", e.target.value)}
                  />
                </div>
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
              </div>
            ))}

            <Button type="button" onClick={addCandidate} variant="outline" className="w-full mt-4">
              Add Another Candidate
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button type="submit" size="lg">
            Rank Candidates
          </Button>
        </div>
      </form>
    </div>
  )
}
