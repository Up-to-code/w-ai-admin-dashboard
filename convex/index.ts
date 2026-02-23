import { ActionRetrier } from "@convex-dev/action-retrier"
import { Crons } from "@convex-dev/crons"
import { components } from "./_generated/api"

export const retrier = new ActionRetrier((components as unknown as { actionRetrier: unknown }).actionRetrier as any)
export const crons = new Crons((components as unknown as { crons: unknown }).crons as any)
