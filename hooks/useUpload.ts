"use client";

import { useState } from "react";
import { uploadFile } from "@/actions/uploadAndSave";
import { generateEmbeddings } from "@/actions/generateEmbeddings";

export enum StatusText {
  UPLOADING = "Uploading file...",
  UPLOADED = "File uploaded successfully",
  SAVING = "Saving file to database...",
  GENERATING = "Generating AI Embeddings, This will only take a few seconds...",
}

export type Status = StatusText[keyof StatusText];

export default function useUpload() {
  const [status, setStatus] = useState<Status | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    try {
      // Step 1: Start uploading with animated progress
      setStatus(StatusText.UPLOADING);
      setProgress(0);

      // Simulate smooth progress animation
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev === null) return 10;
          if (prev >= 90) return 90; // Cap at 90% until upload completes
          return prev + 10;
        });
      }, 200);

      // Step 2: Upload file
      const res = await uploadFile(file);
      
      // Clear interval and set to 100%
      clearInterval(progressInterval);
      setProgress(100);
      setFileId(res.fileId);

      // Small delay to show 100%
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 3: File uploaded
      setStatus(StatusText.UPLOADED);
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Step 4: Saving to database
      setStatus(StatusText.SAVING);
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Step 5: Generating embeddings
      setStatus(StatusText.GENERATING);
      await generateEmbeddings(res.metadata.$id);

      // Small delay before redirect
      await new Promise((resolve) => setTimeout(resolve, 500));

      return res;
    } catch (error) {
      console.error("Upload error:", error);
      setStatus(null);
      setProgress(null);
      throw error;
    }
  };

  return {
    status,
    progress,
    fileId,
    handleUpload,
  };
}