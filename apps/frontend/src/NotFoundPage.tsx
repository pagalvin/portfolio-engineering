import { useNavigate } from 'react-router'
import { defaultWorkspaceRoute } from './scaffoldRoutes'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <section className="status-panel error-panel">
      <p className="eyebrow">Route status</p>
      <h2>Route not found.</h2>
      <p>
        The current route is not mapped to a scaffold page yet. Use the workspace navigation or return to the dashboard.
      </p>
      <button
        type="button"
        className="secondary-button"
        onClick={() => {
          navigate(defaultWorkspaceRoute)
        }}
      >
        Go to Dashboard
      </button>
    </section>
  )
}
