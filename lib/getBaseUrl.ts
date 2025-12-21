const getBaseUrl = () => {
    // Always return localhost for local development
    if (process.env.NODE_ENV === 'development') {
      return "http://localhost:3000";
    }
    
    // For production, use the environment variable
    return process.env.NEXT_PUBLIC_BASE_URL ;
  }
  
  export default getBaseUrl;