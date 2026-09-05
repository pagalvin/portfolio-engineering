import { PlaceholderPage } from './PlaceholderPage'
import type { ScaffoldRoute } from './scaffoldRoutes'

interface SettingsPageProps {
  route: ScaffoldRoute
}

export function SettingsPage({ route }: SettingsPageProps) {
  return <PlaceholderPage route={route} />
}
