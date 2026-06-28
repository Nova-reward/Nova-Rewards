import * as fs from 'fs';
import * as path from 'path';
import { envSchema } from '../apps/api/src/config/env';

function generateEnvExample(): void {
  const schema = envSchema._def.shape();
  const lines: string[] = [];

  lines.push('# Environment Variables');
  lines.push('# Copy this file to .env and fill in your values');
  lines.push('');

  for (const [key, def] of Object.entries(schema)) {
    const description = def.description || '';
    const defaultValue = def._def.defaultValue?.();
    const isRequired = !def._def.defaultValue;

    // Add comment
    if (description) {
      lines.push(`# ${description}`);
    }
    if (!isRequired && defaultValue !== undefined) {
      lines.push(`# Default: ${defaultValue}`);
    }
    if (isRequired) {
      lines.push('# Required');
    }

    // Add the variable
    if (defaultValue !== undefined) {
      lines.push(`${key}=${defaultValue}`);
    } else {
      lines.push(`${key}=`);
    }

    lines.push('');
  }

  const outputPath = path.join(process.cwd(), '.env.example');
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`✅ Generated .env.example at ${outputPath}`);
}

generateEnvExample();
