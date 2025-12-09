import { z } from "zod";

export const FileMetadataSchema = z.object({
    userId: z.string(),
    fileId: z.string(),
    fileName: z.string().max(15),
    fileType: z.string(),
    fileSize: z.number().max(29360128), // 28MB in bytes
    storagePath: z.string(),
});

export type FileMetadataSchema = z.infer<typeof FileMetadataSchema>;