export interface Message {
    id?: string;
    role: "human" | "ai";
    message: string;
    createdAt: Date;
  }
  
  export interface ChatProps {
    id: string;
  }
  
  export interface AskQuestionResponse {
    success: boolean;
    message: string;
  }