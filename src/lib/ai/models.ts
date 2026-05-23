/**
 * Models the Ask endpoint is allowed to invoke. Keeps a stray request from
 * routing to an arbitrary or expensive model.
 */
export const ALLOWED_MODELS = [
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'gpt-5.4',
  'gpt-4.1-mini',
  'gpt-4.1',
] as const

export type AllowedModel = (typeof ALLOWED_MODELS)[number]

/** The default model used by the Ask endpoint. */
export const DEFAULT_MODEL: AllowedModel = 'gpt-5.4-mini'

export function isAllowedModel(model: string): model is AllowedModel {
  return (ALLOWED_MODELS as readonly string[]).includes(model)
}
