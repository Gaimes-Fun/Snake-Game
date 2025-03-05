import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ENV } from '../configs/env';

// Create a base Axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
    baseURL: ENV.API_URL,
    timeout: 10000, // 10 seconds
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Request interceptor for adding auth tokens, etc.
apiClient.interceptors.request.use(
    (config) => {
        // You can add authentication tokens here if needed
        // const token = localStorage.getItem('auth_token');
        // if (token) {
        //     config.headers.Authorization = `Bearer ${token}`;
        // }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for handling common responses
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Handle common errors (401, 403, 500, etc.)
        if (error.response) {
            const { status } = error.response;
            
            switch (status) {
                case 401:
                    console.error('Unauthorized access. Please login again.');
                    // You could trigger a logout or redirect to login here
                    break;
                case 403:
                    console.error('Forbidden access. You do not have permission.');
                    break;
                case 404:
                    console.error('Resource not found.');
                    break;
                case 500:
                    console.error('Server error. Please try again later.');
                    break;
                default:
                    console.error(`Request failed with status code ${status}`);
            }
        } else if (error.request) {
            console.error('No response received from server. Check your network connection.');
        } else {
            console.error('Error setting up request:', error.message);
        }
        
        return Promise.reject(error);
    }
);

// Generic API service class
class ApiService {
    // GET request
    async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.get(url, config);
        return response.data;
    }

    // POST request
    async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.post(url, data, config);
        return response.data;
    }

    // PUT request
    async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.put(url, data, config);
        return response.data;
    }

    // PATCH request
    async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.patch(url, data, config);
        return response.data;
    }

    // DELETE request
    async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await apiClient.delete(url, config);
        return response.data;
    }
}

// Export as a singleton
export const apiService = new ApiService(); 