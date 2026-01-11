#!/usr/bin/env tsx

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import * as readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function main() {
  console.log('\nCreate new E2B sandbox template\n')
  console.log('─'.repeat(60))

  const name = await question('\nTemplate name (e.g., my-template): ')
  if (!name || !/^[a-z0-9-]+$/.test(name)) {
    console.error('✗ Invalid template name. Use lowercase letters, numbers, and hyphens only.')
    process.exit(1)
  }

  const baseImage = await question(
    'Base image (1: Node.js, 2: Python, 3: Custom): ',
  )

  let baseImageCode = ''
  if (baseImage === '1') {
    baseImageCode = `.fromNodeImage('24-slim')`
  } else if (baseImage === '2') {
    baseImageCode = `.fromPythonImage('3.19-slim')`
  } else if (baseImage === '3') {
    const customImage = await question('Custom base image (e.g., ubuntu:22.04, node:20-alpine): ')
    if (!customImage) {
      console.error('✗ Custom image cannot be empty.')
      process.exit(1)
    }
    baseImageCode = `.fromImage('${customImage}')`
  } else {
    console.error('✗ Invalid choice.')
    process.exit(1)
  }

  const port = await question('Port (leave empty for none): ')
  const portNum = port ? parseInt(port, 10) : null

  if (port && (isNaN(portNum!) || portNum! < 1 || portNum! > 65535)) {
    console.error('✗ Invalid port number.')
    process.exit(1)
  }

  const entrypoint = await question(
    `Entrypoint file (e.g., app.py, pages/index.tsx): `,
  )
  const instructions = await question(
    'Instructions for LLM (e.g., "A Next.js app that reloads automatically"): ',
  )

  rl.close()

  const templateDir = join(__dirname, '..', 'sandbox-templates', name)

  if (existsSync(templateDir)) {
    console.error(`\n✗ Template directory already exists: ${templateDir}`)
    process.exit(1)
  }

  console.log(`\n[*] Creating template: ${name}`)
  console.log('─'.repeat(60))

  mkdirSync(templateDir, { recursive: true })

  // package.json
  const packageJson = {
    name,
    version: '1.0.0',
    scripts: {
      'build:dev': 'tsx build.dev.ts',
      'build:prod': 'tsx build.prod.ts',
      build: 'tsx build.prod.ts',
    },
  }
  writeFileSync(
    join(templateDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  )
  console.log('  ✓ Created package.json')

  // template.ts
  const templateTs = `import { Template${portNum ? ', waitForPort' : ''} } from 'e2b'

export const template = Template()
  ${baseImageCode}
  .aptInstall('curl')
  .setWorkdir('/home/user')
  // Add your setup commands here
  // .runCmd('your-install-command')
  ${portNum ? `.setStartCmd('your-start-command', waitForPort(${portNum}))` : `.setStartCmd('your-start-command')`}
`

  writeFileSync(join(templateDir, 'template.ts'), templateTs)
  console.log('  ✓ Created template.ts')

  // build.dev.ts
  const buildDevTs = `import { name as templateAlias } from './package.json'
import { template } from './template'
import 'dotenv/config'
import { defaultBuildLogger, Template } from 'e2b'

const prefix = process.env.E2B_TEMPLATE_PREFIX
const alias = prefix ? \`\${prefix}-\${templateAlias}-dev\` : \`\${templateAlias}-dev\`

Template.build(template, {
  alias,
  cpuCount: 4,
  memoryMB: 4096,
  onBuildLogs: defaultBuildLogger(),
})
`
  writeFileSync(join(templateDir, 'build.dev.ts'), buildDevTs)
  console.log('  ✓ Created build.dev.ts')

  // build.prod.ts
  const buildProdTs = `import { name as templateAlias } from './package.json'
import { template } from './template'
import 'dotenv/config'
import { defaultBuildLogger, Template } from 'e2b'

const prefix = process.env.E2B_TEMPLATE_PREFIX
const alias = prefix ? \`\${prefix}-\${templateAlias}\` : templateAlias

Template.build(template, {
  alias,
  cpuCount: 4,
  memoryMB: 4096,
  onBuildLogs: defaultBuildLogger(),
})
`
  writeFileSync(join(templateDir, 'build.prod.ts'), buildProdTs)
  console.log('  ✓ Created build.prod.ts')

  console.log('\n─'.repeat(60))
  console.log('\n✓ Template created successfully!\n')
  console.log('Next steps:')
  console.log(`  1. cd sandbox-templates/${name}`)
  console.log('  2. Edit template.ts to customize your template')
  console.log('  3. npm install')
  console.log('  4. npm run build:dev')
  console.log(`\n  5. Add to lib/templates.ts:`)
  console.log(`     [getTemplateIdSuffix('${name}')]: {`)
  console.log(`       name: '${name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}',`)
  console.log(`       lib: ['package1', 'package2'],`)
  console.log(`       file: '${entrypoint || 'app.py'}',`)
  console.log(`       instructions: '${instructions || 'Your template description'}',`)
  console.log(`       port: ${portNum || 'null'},`)
  console.log(`     },\n`)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
