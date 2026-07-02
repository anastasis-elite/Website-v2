import { createClient } from '@/lib/supabase/server'
import { isAOSAdmin } from '@/lib/aos/isAOSAdmin'

export async function getAOSAdminUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return isAOSAdmin(user?.email) ? user : null
}
