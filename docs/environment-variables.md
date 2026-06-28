# Environment Variables

## Overview
Environment variables are validated at startup using Zod. The application will exit with descriptive errors if any required variables are missing or invalid.

## Validation Process
1. All environment variables are defined in `apps/api/src/config/env.ts`
2. Zod schema validates type, format, and presence
3. Missing required variables cause the process to exit
4. Optional variables have documented defaults
5. Validated config is the single source of truth

## Adding New Variables

### Step 1: Update Schema
Add the variable to `envSchema` in `apps/api/src/config/env.ts`:

```typescript
NEW_VAR: z.string().min(1, 'NEW_VAR is required'),
npm run generate-env
import { config } from './config/env';

// Use the validated config
const value = config.NEW_VAR;
