'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdaptiveNutritionDashboard from '@/components/AdaptiveNutritionDashboard'

export default function NutritionDashboardClient() {
  const supabase = createClient()
  const [program, setProgram] = useState('ember')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadClient() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: client } = await supabase
        .from('clients')
        .select('program')
        .eq('auth_user_id', user.id)
        .single()

      setProgram(client?.program || 'ember')
      setLoading(false)
    }

    loadClient()
  }, [supabase])

  if (loading) {
    return null
  }

  return <AdaptiveNutritionDashboard program={program} />
}
