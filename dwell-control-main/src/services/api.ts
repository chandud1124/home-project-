
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error.response?.data || error);
  }
);

export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/api/auth/login', credentials),
  
  register: (userData: { name: string; email: string; password: string; role: string; department: string }) =>
    api.post('/api/auth/register', userData),
  
  getProfile: () => api.get('/api/auth/profile'),
  
  logout: () => api.post('/auth/logout'),

  updateProfile: (data: { 
    name?: string; 
    email?: string; 
    currentPassword?: string; 
    newPassword?: string;
  }) => api.put('/auth/profile', data),

  deleteAccount: () => api.delete('/auth/profile'),

  forgotPassword: (email: string) => 
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
};

export const deviceAPI = {
  getAllDevices: () => api.get('/devices'),
  
  createDevice: (deviceData: any) => api.post('/devices', deviceData),
  
  updateDevice: (deviceId: string, updates: any) => 
    api.put(`/devices/${deviceId}`, updates),
  
  deleteDevice: (deviceId: string) => api.delete(`/devices/${deviceId}`),
  
  toggleSwitch: (deviceId: string, switchId: string, state?: boolean) =>
    api.post(`/devices/${deviceId}/switches/${switchId}/toggle`, { state }),
  
  getStats: () => api.get('/devices/stats'),
};

export const scheduleAPI = {
  getAllSchedules: () => api.get('/schedules'),
  
  createSchedule: (scheduleData: any) => api.post('/schedules', scheduleData),
  
  updateSchedule: (scheduleId: string, updates: any) =>
    api.put(`/schedules/${scheduleId}`, updates),
  
  deleteSchedule: (scheduleId: string) => api.delete(`/schedules/${scheduleId}`),
  
  toggleSchedule: (scheduleId: string) => api.put(`/schedules/${scheduleId}/toggle`),
};

export const activityAPI = {
  getActivities: (filters?: any) => api.get('/activities', { params: filters }),
  
  getDeviceActivities: (deviceId: string) => api.get(`/activities/device/${deviceId}`),
  
  getUserActivities: (userId: string) => api.get(`/activities/user/${userId}`),
};

export const securityAPI = {
  getAlerts: () => api.get('/security/alerts'),
  
  acknowledgeAlert: (alertId: string) => api.put(`/security/alerts/${alertId}/acknowledge`),
  
  createAlert: (alertData: any) => api.post('/security/alerts', alertData),
};

export default api;
