"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import type { FileUploadProps } from "@/types/resume-ranker"
import { FileIcon, UploadIcon, XIcon } from "lucide-react"

export function FileUpload({ id, label, accept = ".pdf,.doc,.docx", onChange, currentFile }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      const fileType = file.type
      const fileName = file.name.toLowerCase()

      // Check if file is PDF, DOC, or DOCX
      if (
        fileType === "application/pdf" ||
        fileType === "application/msword" ||
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".pdf") ||
        fileName.endsWith(".doc") ||
        fileName.endsWith(".docx")
      ) {
        onChange(file)
      } else {
        alert("Please upload a PDF, DOC, or DOCX file")
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onChange(e.target.files[0])
    }
  }

  const handleRemoveFile = () => {
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Get file type for display
  const getFileType = () => {
    if (!currentFile) return ""

    const fileName = currentFile.name.toLowerCase()
    if (fileName.endsWith(".pdf")) return "PDF"
    if (fileName.endsWith(".doc")) return "DOC"
    if (fileName.endsWith(".docx")) return "DOCX"
    return "Document"
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>

      {!currentFile ? (
        <div
          className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon className="mx-auto h-6 w-6 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">
            Drag and drop a file, or <span className="text-primary font-medium">click to browse</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Supports PDF, DOC, and DOCX files</p>
          <input
            id={id}
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={accept}
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between border rounded-md p-3">
          <div className="flex items-center space-x-2">
            <FileIcon className="h-5 w-5 text-primary" />
            <div>
              <span className="text-sm truncate max-w-[200px] block">{currentFile.name}</span>
              <span className="text-xs text-gray-500">
                {getFileType()} • {formatFileSize(currentFile.size)}
              </span>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile} className="h-8 w-8 p-0">
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Remove file</span>
          </Button>
        </div>
      )}
    </div>
  )
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}
