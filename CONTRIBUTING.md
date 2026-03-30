# Contributing to Nova Rewards

Thank you for your interest in contributing to Nova Rewards! This guide outlines how open-source contributors can add features and fix bugs in the Nova Rewards frontend.

## Prerequisites

Before making any changes, please read the following guides:

- **[Stellar & Soroban Integration Tutorial](docs/stellar/integration.md)** — Required reading for any work touching the blockchain layer, transaction submission, or Soroban contracts.

## Getting Started

### Fork and Clone the Repository

1. Fork the repository on GitHub by clicking the "Fork" button.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/Nova-Rewards.git
   cd Nova-Rewards
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/milah-247/Nova-Rewards.git
   ```

### Local Setup

1. Navigate to the frontend directory:
   ```bash
   cd novaRewards/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local` (if it exists) and fill in the required values.
   - Ensure you have the necessary API keys and configuration for Stellar integration.

4. Start the development server:
   ```bash
   npm run dev
   ```
   The application should now be running at `http://localhost:3000`.

## Branching Strategy

We follow a Git Flow-inspired branching model:

- **`main`**: Production-ready code. Only updated via pull requests from `develop`.
- **`develop`**: Integration branch for ongoing development. Feature and fix branches merge here.
- **`feature/*`**: For new features (e.g., `feature/user-dashboard`).
- **`fix/*`**: For bug fixes (e.g., `fix/login-validation`).

Always create feature branches from `develop` and merge back to `develop` via pull requests.

## Pull Request Process

1. Create a feature branch from `develop`:
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes, following the code standards below.

3. Commit your changes using conventional commits:
   ```
   feat: add user dashboard component
   fix: resolve login validation bug
   ```

4. Push your branch and create a pull request to `develop`:
   - Provide a clear description of the changes.
   - Reference any related issues.
   - Ensure all tests pass and code style checks are met.

5. Wait for review and address any feedback.

## Component Standards

### File Naming
- Use PascalCase for component files: `UserDashboard.tsx`

### Folder Structure
Organize code into the following directories within `novaRewards/frontend/src/`:
- `components/`: Reusable UI components
- `hooks/`: Custom React hooks
- `services/`: API calls and external service integrations
- `pages/`: Next.js pages

### Testing
- Every component must have a co-located test file: `ComponentName.test.tsx`
- Write unit tests for components, hooks, and services.

## Code Style

Code style is enforced by ESLint and Prettier.

- Run linting: `npm run lint`
- Auto-fix issues: `npm run lint:fix`

Ensure your code passes all linting checks before submitting a pull request.

## Testing

### Running Tests
- Run unit tests: `npm test`
- Run tests with coverage: `npm run test:coverage`

### Writing Tests
- Use Jest for unit testing.
- Place test files alongside the code they test (e.g., `Component.tsx` and `Component.test.tsx`).
- Aim for high test coverage, especially for critical business logic.

## Good First Issues

Looking for a place to start contributing? Check out our [Good First Issues](https://github.com/milah-247/Nova-Rewards/issues?q=is%3Aissue+is%3Aopen+label%3Agood-first-issue) on GitHub. These are beginner-friendly tasks that introduce you to the codebase.

If you have any questions, feel free to open an issue or join our discussions!
