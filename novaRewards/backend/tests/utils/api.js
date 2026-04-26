function createApiClient(baseURL = '/') {
  return {
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    validateStatus: (status) => status >= 200 && status < 300,
  };
}

function extractResponseInterceptor(apiClient, index = 0) {
  if (!apiClient || !apiClient.interceptors || !apiClient.interceptors.response) {
    throw new Error('API client does not expose interceptors.response');
  }

  const interceptor = apiClient.interceptors.response.handlers[index];
  if (!interceptor) {
    throw new Error(`No response interceptor found at index ${index}`);
  }
  return interceptor;
}

function buildHttpError(status, data = {}) {
  const error = new Error(`Request failed with status ${status}`);
  error.response = { status, data };
  return error;
}

module.exports = {
  createApiClient,
  extractResponseInterceptor,
  buildHttpError,
};
