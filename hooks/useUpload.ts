"use client";

import { useState } from "react";
import { uploadFile } from "@/actions/uploadAndSave";
import { set } from "zod";

export enum StatusText {
    UPLOADING = "Uploading file...",
    UPLOADED = "File uploaded successfully",
    SAVING = "Saving file to database...",
    GENERATING = "Generating AI Embeddings, This will only take a few seconds...",
  }
  
export type Status = StatusText[keyof StatusText];

export default function () {
  const [status, setStatus] = useState<Status | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  

  const handleUpload = async (file: File) => {
    setStatus(StatusText.UPLOADING);
    setProgress(30);

    const res = await uploadFile(file);
    setFileId(res.metadata.$id);
    setProgress(100);
    setStatus(StatusText.UPLOADED);
    setStatus(StatusText.SAVING);
    setStatus(StatusText.GENERATING);
    //generate Ai embeddings
    return res;
};
  return{
    status,
    progress,
    fileId,
    handleUpload,
  };
}

