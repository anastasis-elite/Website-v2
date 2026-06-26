// marketing/prompts/types.ts

export type PromptContext = {
  campaign?: string
  pillar?: string
  platform?: string
  hookFamily?: string
  contentType?: string
  topic?: string
  cta?: string
  audienceStage?: string
}

export type PromptWorker = {
  name: string
  purpose: string
  inputs: string[]
  output: string
  prompt: string
}
