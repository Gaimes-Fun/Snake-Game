// Environment variables with default fallbacks
export const ENV = {  
  // API Configuration
  API_URL: import.meta.env.VITE_API_URL || '',
  
  // Colyseus Configuration
  COLYSEUS_SERVER_URL: import.meta.env.VITE_COLYSEUS_SERVER_URL || 'ws://localhost:2567',
  
  // Environment detection
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
  MODE: import.meta.env.MODE,
}; 