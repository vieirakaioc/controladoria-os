'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      await supabase.auth.signOut()
      router.push('/login')
    })()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
      <div className="text-gray-600 font-black">Saindo...</div>
    </div>
  )
}