// Suppress console.error during tests to reduce noise from expected validation errors
jest.spyOn(console, 'error').mockImplementation(() => {});
