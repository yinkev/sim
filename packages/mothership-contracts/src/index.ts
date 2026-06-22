export const MOTHERSHIP_CONTRACT_PACKAGE = '@sim/mothership-contracts'

export const MOTHERSHIP_CONTRACT_FILES = {
  metrics: 'contracts/metrics-v1.schema.json',
  stream: 'contracts/mothership-stream-v1.schema.json',
  toolCatalog: 'contracts/tool-catalog-v1.json',
  traceAttributeValues: 'contracts/trace-attribute-values-v1.schema.json',
  traceAttributes: 'contracts/trace-attributes-v1.schema.json',
  traceEvents: 'contracts/trace-events-v1.schema.json',
  traceSpans: 'contracts/trace-spans-v1.schema.json',
} as const

export type MothershipContractFile =
  (typeof MOTHERSHIP_CONTRACT_FILES)[keyof typeof MOTHERSHIP_CONTRACT_FILES]

export * from './auth'
export * from './contract'
export * from './routes'
export * from './subagents'
export * from './tool-catalog'
