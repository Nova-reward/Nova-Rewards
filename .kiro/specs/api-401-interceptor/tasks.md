# Implementation Plan: API 401 Interceptor

## Overview

Add a response interceptor to the axios instance in `api.js` that redirects to `/reauth` on 401 responses, create the `/reauth` page, install fast-check, and add unit + property-based tests.

## Tasks

- [ ] 1. Install fast-check as a dev dependency
  - Run `npm install --save-dev fast-check` inside `novaRewards/frontend`
  - Verify it appears in `package.json` devDependencies
  - _Requirements: 1.1_

- [ ] 2. Add the 401 response interceptor to `novaRewards/frontend/lib/api.js`
  - [ ] 2.1 Import `Router` from `next/router` and register the interceptor
    - Add `import Router from 'next/router'` at the top of `api.js`
    - Register `api.interceptors.response.use(successHandler, errorHandler)` immediately after `api` is created
    - Success handler: return the response unchanged
    - Error handler: if `error.response?.status === 401`, call `Router.push('/reauth')`; always `return Promise.reject(error)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 4.3_

  - [ ]* 2.2 Write property test — Property 1: 2xx responses pass through unchanged
    - File: `novaRewards/frontend/__tests__/api.interceptor.test.js`
    - Mock `next/router` with `jest.mock('next/router', () => ({ push: jest.fn() }))`
    - Extract the success handler from `api.interceptors.response.handlers[0].fulfilled`
    - Use `fc.integer({ min: 200, max: 299 })` and `fc.object()` to generate mock responses
    - Assert the returned value is the same reference as the input
    - **Property 1: 2xx responses pass through unchanged**
    - **Validates: Requirements 1.2**

  - [ ]* 2.3 Write property test — Property 2: 401 errors trigger a redirect
    - File: `novaRewards/frontend/__tests__/api.interceptor.test.js`
    - Extract the error handler from `api.interceptors.response.handlers[0].rejected`
    - Use `fc.record({ response: fc.record({ status: fc.constant(401), data: fc.object() }) })` to generate mock errors
    - Assert `Router.push` was called with `'/reauth'` for every generated input
    - **Property 2: 401 errors trigger a redirect**
    - **Validates: Requirements 1.3**

  - [ ]* 2.4 Write property test — Property 3: Non-401 errors are re-thrown unchanged
    - File: `novaRewards/frontend/__tests__/api.interceptor.test.js`
    - Generate status codes from the set {400, 402–599} using `fc.integer({ min: 400, max: 599 }).filter(s => s !== 401)`
    - Assert the rejected value is the same object reference and `Router.push` was not called
    - **Property 3: Non-401 errors are re-thrown unchanged**
    - **Validates: Requirements 1.4, 4.1**

  - [ ]* 2.5 Write property test — Property 4: 401 handling always rejects the promise
    - File: `novaRewards/frontend/__tests__/api.interceptor.test.js`
    - Generate `AxiosError`-shaped objects with `response.status = 401`
    - Assert the return value is a rejected promise using `await expect(handler(error)).rejects.toBe(error)`
    - **Property 4: 401 handling always rejects the promise**
    - **Validates: Requirements 4.3**

  - [ ]* 2.6 Write unit tests — example-based cases for the interceptor
    - File: `novaRewards/frontend/__tests__/api.interceptor.test.js`
    - Example A: assert `api.interceptors.response.handlers` has exactly one entry after import — covers Requirements 1.1, 3.1, 3.2
    - Example B: create an error with no `response` property, pass to error handler, assert `Router.push` not called and promise rejects — covers Requirement 4.2
    - _Requirements: 1.1, 3.1, 3.2, 4.2_

- [ ] 3. Checkpoint — ensure all interceptor tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create `novaRewards/frontend/pages/reauth.js`
  - [ ] 4.1 Implement the reauth page component
    - Create a default-exported React component with no props and no API calls
    - Render a heading "Session Expired"
    - Render a short explanatory paragraph stating the API key is invalid or has expired
    - Render a link (`<a href="/merchant">`) with text "Return to Merchant Portal"
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.2 Write unit tests for the reauth page
    - File: `novaRewards/frontend/__tests__/ReauthPage.test.js`
    - Render `<ReauthPage />` with no props
    - Assert the explanatory message is present in the document
    - Assert a link pointing to `/merchant` exists
    - Example C from design testing strategy
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 5. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
