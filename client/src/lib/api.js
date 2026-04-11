import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const api = axios.create({ baseURL });

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Add request interceptor to handle Dash authentication
api.interceptors.request.use(async (config) => {
  // Check for Dash session
  const dashSession = localStorage.getItem('dashSession');

  if (dashSession && !config.headers.Authorization) {
    try {
      const session = JSON.parse(dashSession);
      if (session.identityId) {
        // Add custom headers for Dash authentication
        config.headers['x-dash-identity'] = session.identityId;

        // If we have a session token, add it as well
        if (session.sessionToken) {
          config.headers['x-dash-session'] = session.sessionToken;
        }
      }
    } catch (e) {
      console.error('Failed to parse dashSession:', e);
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid sessions
      localStorage.removeItem('dashSession');
      localStorage.removeItem('user');

      // Only redirect to login if we're not already there
      if (!window.location.pathname.includes('/')) {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);