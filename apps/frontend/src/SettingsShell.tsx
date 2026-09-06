import { NavLink, Outlet } from 'react-router'

export function SettingsShell() {
  return (
    <section className="workspace-content">
      <header className="status-panel settings-page-header">
        <p className="eyebrow">System settings</p>
        <h2>Settings</h2>
        <p>Manage your AI connections and app preferences.</p>
      </header>

      <nav className="settings-tabs" aria-label="Settings sections">
        <div role="tablist" aria-label="Settings tabs" className="actions-row">
          <NavLink
            to="/workspace/settings/your-ai"
            role="tab"
            className="nav-link"
          >
            Your AI
          </NavLink>
          <NavLink
            to="/workspace/settings/profile"
            role="tab"
            className="nav-link"
          >
            Investor Profile
          </NavLink>
          <NavLink
            to="/workspace/settings/preferences"
            role="tab"
            className="nav-link"
          >
            Preferences
          </NavLink>
        </div>
      </nav>

      <div className="settings-tab-content">
        <Outlet />
      </div>
    </section>
  )
}
