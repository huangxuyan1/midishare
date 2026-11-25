/**
 * /u/:id - a person's public page: their display name and published clips.
 * Open to everyone, signed in or not. The clip page links here from "by Name".
 */
import { useParams } from 'react-router-dom'
import { ProfileView } from '@/components/ProfileView'

export default function UserPage() {
  const { id } = useParams()
  // The key starts the view afresh when going from one person's page to another's.
  return <ProfileView key={id} userId={id ?? ''} />
}
