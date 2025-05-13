"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"

// Dynamically import the ResumeRanker with SSR disabled
const ResumeRanker = dynamic(() => import("@/components/resume-ranker").then((mod) => mod.ResumeRanker), {
  ssr: false,
  loading: () => <div className="text-center py-8">Loading Resume Ranker...</div>,
})

export function ResumeRankerWrapper() {
  return (
    <Suspense fallback={<div className="text-center py-8">Loading Resume Ranker...</div>}>
      <ResumeRanker />
    </Suspense>
  )
}
