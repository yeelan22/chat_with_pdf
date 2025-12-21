'use client'
import { useUser } from "@clerk/nextjs";
import  useSWR  from "swr";

export const PRO_LIMIT = 20;
export const FREE_LIMIT = 2;

interface Subscription {
    hasActiveMembership: boolean;
    filesCount: number;
    userLimit: number;
    isOverFileLimit: boolean;
}

const fetcher = (url: string): Promise<Subscription> => fetch(url).then(res => res.json());

function useSubscription() {
  const { user, isLoaded } = useUser();
  const { data, error, isLoading, mutate } = useSWR<Subscription>(
    isLoaded && user ? '/api/subscription' : null,
    fetcher,
    {
        refreshInterval: 15000, // Refresh every 15 seconds
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
    }
  );
  return {
    hasActiveMembership: data?.hasActiveMembership ?? null,
    isOverFileLimit: data?.isOverFileLimit ?? false,
    filesCount: data?.filesCount ?? 0,
    userLimit: data?.userLimit ?? FREE_LIMIT,
    loading: !isLoaded || isLoading,
    error: error ?? null,
    refresh: mutate, // Call this after uploading a file
  };
}

export default useSubscription;
