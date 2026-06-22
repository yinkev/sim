import type { z } from 'zod'

export type MothershipHttpMethod = 'GET' | 'POST' | 'DELETE'

export type MothershipSchema = z.ZodType

export type MothershipJsonResponseMode<S extends MothershipSchema = MothershipSchema> = {
  mode: 'json'
  schema: S
  status?: number | readonly number[]
}

export type MothershipStreamResponseMode = {
  mode: 'stream'
  status?: number | readonly number[]
}

export type MothershipEmptyResponseMode = {
  mode: 'empty'
  status?: number | readonly number[]
}

export type MothershipResponseMode<S extends MothershipSchema = MothershipSchema> =
  | MothershipJsonResponseMode<S>
  | MothershipStreamResponseMode
  | MothershipEmptyResponseMode

export interface MothershipRouteContract<
  TQuery extends MothershipSchema | undefined = undefined,
  TBody extends MothershipSchema | undefined = undefined,
  THeaders extends MothershipSchema | undefined = undefined,
  TResponse extends MothershipResponseMode = MothershipResponseMode,
> {
  method: MothershipHttpMethod
  path: string
  query?: TQuery
  body?: TBody
  headers?: THeaders
  response: TResponse
}

export function defineMothershipRouteContract<
  TQuery extends MothershipSchema | undefined = undefined,
  TBody extends MothershipSchema | undefined = undefined,
  THeaders extends MothershipSchema | undefined = undefined,
  TResponse extends MothershipResponseMode = MothershipResponseMode,
>(
  contract: MothershipRouteContract<TQuery, TBody, THeaders, TResponse>
): MothershipRouteContract<TQuery, TBody, THeaders, TResponse> {
  return contract
}
