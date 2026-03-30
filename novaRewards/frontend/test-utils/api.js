import axios from 'axios';

export function createApiClient(baseURL = '/') {
  return axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true,
  });
}

export function extractResponseInterceptor(apiClient, index = 0) {
  const interceptor = apiClient.interceptors.response.handlers[index];
  if (!interceptor) {
    throw new Error(`No response interceptor found at index ${index}`);
  }
  return interceptor;
}

export function buildAxiosError(status, data = {}) {
  const error = new Error(`Request failed with status ${status}`);
  error.response = { status, data };
  return error;
}

export function buildFetchRequest(body = {}, init = {}) {
  return {
    json: async () => body,
    text: async () => JSON.stringify(body),
    status: init.status || 200,
    ok: init.status ? init.status >= 200 && init.status < 300 : true,
    headers: init.headers || { 'Content-Type': 'application/json' },
    ...init,
  };
}
