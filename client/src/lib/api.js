import axios from "axios";

// Change port from 4000 to 5000 to match your backend
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const api = axios.create({ baseURL });

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setAuthToken(null);
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default api;

