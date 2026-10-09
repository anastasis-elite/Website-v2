import { revalidatePath } from 'next/cache'
export function invalidateDailyPlan() { revalidatePath('/dashboard', 'layout') }
