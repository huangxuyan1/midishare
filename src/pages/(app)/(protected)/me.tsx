/**
 * /me - your own page ("My clips" in the nav): your display name, your drafts
 * and your published clips. Sign-in required (protected folder).
 */
import { useAuth } from 'deepspace'
import { ProfileView } from '@/components/ProfileView'

export default function MyPage() {
  const { userId } = useAuth()
  if (!userId) return null
  return <ProfileView userId={userId} />
}
