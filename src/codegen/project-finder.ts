import * as fs from 'node:fs'
import * as path from 'node:path'

export { toWorkerKey } from './key-utils'

/**
 * Recursively searches for registry.ts / registry.js containing `createPageRegistry(`.
 */
export function findRegistryFile(dir: string): string | null {
  const queue = [dir]
  while (queue.length > 0) {
    const current = queue.shift()!
    try {
      const files = fs.readdirSync(current)
      for (const file of files) {
        const fullPath = path.join(current, file)
        if (file === 'node_modules' || file === '.git' || file === 'dist') continue
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          queue.push(fullPath)
        } else if (file === 'registry.ts' || file === 'registry.js') {
          try {
            const content = fs.readFileSync(fullPath, 'utf8')
            if (content.includes('createPageRegistry(')) {
              return fullPath
            }
          } catch {
            // Ignore unreadable individual files during traversal
          }
        }
      }
    } catch {
      // Ignore inaccessible directories during traversal
    }
  }

  let parent = path.dirname(dir)
  while (parent !== dir) {
    const checkPath = path.join(parent, 'registry.ts')
    if (fs.existsSync(checkPath)) {
      try {
        const content = fs.readFileSync(checkPath, 'utf8')
        if (content.includes('createPageRegistry(')) return checkPath
      } catch {
        // Ignore unreadable registry candidate
      }
    }

    const checkPathSrc = path.join(parent, 'src', 'pages', 'registry.ts')
    if (fs.existsSync(checkPathSrc)) {
      try {
        const content = fs.readFileSync(checkPathSrc, 'utf8')
        if (content.includes('createPageRegistry(')) return checkPathSrc
      } catch {
        // Ignore unreadable registry candidate in src/pages
      }
    }

    dir = parent
    parent = path.dirname(dir)
  }

  return null
}

/**
 * Searches upwards or downwards for playwright.config.ts / playwright.config.js.
 */
export function findPlaywrightConfig(dir: string): string | null {
  const queue = [dir]
  while (queue.length > 0) {
    const current = queue.shift()!
    try {
      const files = fs.readdirSync(current)
      for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'dist') continue
        const fullPath = path.join(current, file)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          queue.push(fullPath)
        } else if (file === 'playwright.config.ts' || file === 'playwright.config.js') {
          return fullPath
        }
      }
    } catch {
      // Ignore inaccessible directories during traversal
    }
  }

  let parent = path.dirname(dir)
  while (parent !== dir) {
    const tsPath = path.join(parent, 'playwright.config.ts')
    const jsPath = path.join(parent, 'playwright.config.js')
    if (fs.existsSync(tsPath)) return tsPath
    if (fs.existsSync(jsPath)) return jsPath
    dir = parent
    parent = path.dirname(dir)
  }

  return null
}

/**
 * Parses key-value pairs from a `.env` file in the given directory.
 */
export function parseDotEnv(cwd: string): Record<string, string> {
  const env: Record<string, string> = {}
  const envPath = path.join(cwd, '.env')
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8')
      const lines = content.split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const index = trimmed.indexOf('=')
        if (index > 0) {
          const key = trimmed.slice(0, index).trim()
          let val = trimmed.slice(index + 1).trim()
          if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
            val = val.slice(1, -1)
          }
          env[key] = val
        }
      }
    } catch {
      // Return partial or empty env map if file reading is interrupted
    }
  }
  return env
}

/**
 * Resolves the base URL from .env, playwright.config, or env utility files.
 */
export function getBaseUrl(cwd: string): string {
  const env = parseDotEnv(cwd)
  const envUrl = process.env.URL || env['URL']
  if (envUrl) {
    return envUrl
  }

  let configPath = path.join(cwd, 'playwright.config.ts')
  if (!fs.existsSync(configPath)) {
    configPath = path.join(cwd, 'playwright.config.js')
  }

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8')
      const stringMatch = content.match(/baseURL:\s*['"`](.*?)['"`]/)
      if (stringMatch && stringMatch[1]) {
        return stringMatch[1]
      }

      if (/baseURL:\s*(?:env|ENV)\.url/.test(content)) {
        let envFilePath = path.join(cwd, 'src', 'utils', 'env.ts')
        if (!fs.existsSync(envFilePath)) {
          envFilePath = path.join(cwd, 'src', 'utils', 'env.js')
        }
        if (fs.existsSync(envFilePath)) {
          const envContent = fs.readFileSync(envFilePath, 'utf8')
          const stringMatches = [...envContent.matchAll(/['"`](https?:\/\/.*?)['"`]/g)]
          if (stringMatches.length > 0) {
            return stringMatches[0][1]
          }
        }
      }
    } catch {
      // Fall back to empty string if playwright config is invalid or unreadable
    }
  }
  return ''
}

/**
 * Resolves test directory from playwright.config or defaults to cwd.
 */
export function getTestDir(cwd: string): string {
  let configPath = path.join(cwd, 'playwright.config.ts')
  if (!fs.existsSync(configPath)) {
    configPath = path.join(cwd, 'playwright.config.js')
  }

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8')
      const testDirMatch = content.match(/testDir:\s*['"`](.*?)['"`]/)
      if (testDirMatch && testDirMatch[1]) {
        return path.resolve(cwd, testDirMatch[1])
      }
    } catch {
      // Fall back to cwd if testDir parsing fails
    }
  }

  return cwd
}

/**
 * Finds the next incremental test index in the codegen output directory.
 */
export function getNextTestIndex(testDir: string): number {
  if (!fs.existsSync(testDir)) return 1
  try {
    const files = fs.readdirSync(testDir)
    let max = 0
    for (const file of files) {
      const match = file.match(/^(\d+)\.recorded\.test\.(ts|js)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > max) {
          max = num
        }
      }
    }
    return max + 1
  } catch {
    // Default to index 1 if test directory is unreadable
    return 1
  }
}

/**
 * Formats a recording date for comments in generated test files.
 */
export function formatRecordingDate(date: Date): string {
  const day = date.getDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[date.getMonth()]
  const year = date.getFullYear()

  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12

  return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds} ${ampm}`
}
