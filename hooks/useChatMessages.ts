"use client";

import { useEffect, useState } from "react";
import { Message } from "@/types/chat";

interface UseChatMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: Error | null;
}

export function useChatMessages(fileId: string): UseChatMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fileId) {
      setLoading(false);
      return;
    }

    console.log("🟢 useChatMessages mounted with fileId:", fileId);

    // Fetch initial messages via API route
    const fetchMessages = async () => {
      try {
        setLoading(true);
        console.log("🔵 Fetching messages for fileId:", fileId);
        
        const response = await fetch(`/api/messages/${fileId}`);
        
        console.log("📡 Response status:", response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("❌ Response not OK:", errorData);
          throw new Error(errorData.error || "Failed to fetch messages");
        }

        const data = await response.json();
        console.log("✅ Fetched messages:", data.messages?.length || 0);
        
        setMessages(data.messages || []);
        setError(null);
      } catch (err) {
        console.error("❌ Error fetching messages:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch messages"));
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Poll for new messages every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/messages/${fileId}`);
        
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error("❌ Error polling messages:", err);
        // Don't set error state during polling to avoid UI disruption
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [fileId]);

  return { messages, loading, error };
}