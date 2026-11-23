import { Link } from 'react-router-dom'
import { APP_NAME } from '../constants'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
      <title>{`Not found · ${APP_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <h1 className="mb-2 font-mono text-5xl font-semibold text-primary">404</h1>
      <p className="text-muted-foreground mb-6">Page not found</p>
      <Link
        to="/home"
        className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Back to the clips
      </Link>
    </div>
  )
}
