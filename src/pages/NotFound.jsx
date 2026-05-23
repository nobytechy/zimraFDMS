import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-4 py-20 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">404</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-zim-ink-900">Page not found</h1>
        <p className="mt-3 text-zim-ink-500">The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn-primary mt-6">Back to home</Link>
      </div>
    </div>
  )
}
