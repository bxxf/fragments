import { name as templateAlias } from './package.json'
import { template } from './template'
import 'dotenv/config'
import { defaultBuildLogger, Template } from 'e2b'

const prefix = process.env.E2B_TEMPLATE_PREFIX
const alias = prefix ? `${prefix}-${templateAlias}-dev` : `${templateAlias}-dev`

Template.build(template, {
  alias,
  cpuCount: 2,
  memoryMB: 2048,
  onBuildLogs: defaultBuildLogger(),
})
