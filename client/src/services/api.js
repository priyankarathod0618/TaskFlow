
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function getToken() {
  return localStorage.getItem('tf_token');
}

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }
  const workspaceId = localStorage.getItem('tf_workspace_id');
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId;

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({
    message: 'Unexpected server response.'
  }));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}
