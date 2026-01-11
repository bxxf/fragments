#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { readdirSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const TEMPLATES_DIR = join(__dirname, '..', 'sandbox-templates')
const isDev = process.argv.includes('--dev')
const buildScript = isDev ? 'build:dev' : 'build:prod'
const prefix = process.env.E2B_TEMPLATE_PREFIX

if (prefix) {
  console.log(`\nBuilding all E2B sandbox templates with prefix: ${prefix} (${isDev ? 'development' : 'production'} mode)...\n`)
} else {
  console.log(`\nBuilding all E2B sandbox templates (${isDev ? 'development' : 'production'} mode)...\n`)
  console.log('Note: Set E2B_TEMPLATE_PREFIX in .env.local to avoid name conflicts\n')
}

// Get all template directories
const templateDirs = readdirSync(TEMPLATES_DIR).filter((dir) => {
  const fullPath = join(TEMPLATES_DIR, dir)
  return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'package.json'))
})

if (templateDirs.length === 0) {
  console.log('No templates found in sandbox-templates/')
  process.exit(0)
}

console.log(`Found ${templateDirs.length} template(s): ${templateDirs.join(', ')}\n`)

let successCount = 0
let failureCount = 0
const failures: { name: string; error: string }[] = []

for (const templateDir of templateDirs) {
  const templatePath = join(TEMPLATES_DIR, templateDir)
  console.log(`\n[*] Building template: ${templateDir}`)
  console.log('─'.repeat(60))

  try {
    // Install dependencies
    console.log(`  → Installing dependencies...`)
    execSync('npm install', {
      cwd: templatePath,
      stdio: 'inherit',
    })

    // Build template
    console.log(`  → Running ${buildScript}...`)
    execSync(`npm run ${buildScript}`, {
      cwd: templatePath,
      stdio: 'inherit',
    })

    const builtName = prefix ? `${prefix}-${templateDir}` : templateDir
    console.log(`  ✓ Successfully built ${builtName}${isDev ? '-dev' : ''}`)
    successCount++
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`  ✗ Failed to build ${templateDir}`)
    failureCount++
    failures.push({ name: templateDir, error: errorMessage })
  }
}

// Summary
console.log('\n' + '─'.repeat(60))
console.log('\nBuild Summary:')
console.log(`  ✓ Successful: ${successCount}`)
console.log(`  ✗ Failed: ${failureCount}`)

if (failures.length > 0) {
  console.log('\nFailed templates:')
  failures.forEach(({ name }) => {
    console.log(`  - ${name}`)
  })
  console.log('\nRun the script again or build failed templates individually.')
  process.exit(1)
} else {
  console.log('\nAll templates built successfully!')

  if (prefix) {
    console.log('\nUpdate lib/templates.ts with your prefixed template IDs:')
    templateDirs.forEach((dir) => {
      console.log(`  [getTemplateIdSuffix('${prefix}-${dir}')]: { ... }`)
    })
  }

  console.log('\nYou can now start the development server with: npm run dev')
}
