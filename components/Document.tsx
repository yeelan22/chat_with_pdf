
'use client'
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import byteSize from 'byte-size';
import useSubscription from '@/hooks/useSubscription';
import { Button } from './ui/button';
import { deleteDocument } from "@/actions/deleteDocument";
import { Trash2Icon, DownloadCloud } from 'lucide-react';

const Document = ({
    fileId,
    name,
    size,
}: {
    fileId: string;
    name: string;
    size: number;
}) => {
    const router = useRouter();
    const [isDeleting, startTransaction] = useTransition();
    const { hasActiveMembership } = useSubscription();

    // Use API routes instead of direct Appwrite URLs
    const downloadUrl = `/api/${fileId}/download`;

    return (
        <div className="flex flex-col w-64 h-80 rounded-xl bg-white drop-shadow-md justify-between p-4 transition-all transform hover:scale-105 hover:bg-indigo-600 hover:text-white cursor-pointer group">
            <div onClick={() => router.push(`/dashboard/files/${fileId}`)} className='flex-1'>
                <p className='font-semibold line-clamp-2'>{name || fileId}</p>
                <p className='text-sm text-gray-500 group-hover:text-indigo-100'>
                    {byteSize(size).value} KB
                </p>
            </div>
            
            <div className="flex space-x-2 justify-end">
                <Button
                    variant="outline"
                    disabled={isDeleting || !hasActiveMembership}
                    onClick={() => {
                        if (window.confirm("Are you sure you want to delete this document?")) {
                            startTransaction(async () => {
                                await deleteDocument(fileId);
                            });
                        }
                    }}
                >
                    <Trash2Icon className="h-6 w-6 text-red-500" />
                    {!hasActiveMembership && (
                        <span className="text-red-500 ml-2">PRO Feature</span>
                    )}
                </Button>

                <Button variant="outline" asChild>
                    <a href={downloadUrl} download={name}>
                        <DownloadCloud className="h-6 w-6 text-indigo-600" />
                    </a>
                </Button>
            </div>
        </div>
    );
};

export default Document;