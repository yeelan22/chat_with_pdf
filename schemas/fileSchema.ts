import { z } from "zod";

export const FileMetadataSchema = z.object({
    userId: z.string(),
    fileId: z.string(),
    name: z.string().max(100),
    type: z.string(),
    size: z.number().max(29360128), // 28MB in bytes
    storagePath: z.string(),
    downloadUrl: z.url(),
});

export type FileMetadataSchema = z.infer<typeof FileMetadataSchema>;