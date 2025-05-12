import { ResumeRanker } from "@/components/resume-ranker"

export default function Home() {
  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">AI Resume Ranker</h1>
      <p className="text-center mb-8 text-gray-600 max-w-2xl mx-auto">
        Upload a job description and candidate resumes to get AI-powered rankings based on how well each candidate
        matches the requirements.
      </p>
      <ResumeRanker />
    </main>
  )
}
