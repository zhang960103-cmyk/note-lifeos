/**
 * 环境变量验证模块
 * 在应用启动时调用，确保所有必需的配置都已设置
 */

export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_ENV_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

const OPTIONAL_ENV_VARS = [
  "VITE_SUPABASE_ANON_KEY",
] as const;

export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = import.meta.env[key];
    if (!value) {
      errors.push(`Missing required environment variable: ${key}`);
    } else if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`Environment variable ${key} is empty or invalid`);
    }
  }

  for (const key of OPTIONAL_ENV_VARS) {
    const value = import.meta.env[key];
    if (!value) {
      warnings.push(`Optional environment variable ${key} not set`);
    }
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl && !isValidUrl(supabaseUrl)) {
    errors.push(`VITE_SUPABASE_URL is not a valid URL: ${supabaseUrl}`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export function getEnvVar(key: string): string {
  const value = (import.meta.env as Record<string, string>)[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

export function initializeEnvironment(): void {
  const result = validateEnvironment();

  if (!result.isValid) {
    const errorMsg =
      "Environment validation failed:\n" +
      result.errors.map(e => `  ❌ ${e}`).join("\n");
    console.error(errorMsg);
    throw new Error(`Configuration Error: ${result.errors[0]}\n\nPlease contact support.`);
  }

  if (result.warnings.length > 0) {
    console.warn("Environment warnings:");
    result.warnings.forEach(w => console.warn(`  ⚠️ ${w}`));
  }

  console.info("✅ Environment validation passed");
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
