export type NavGroup = 'Portfolio' | 'Execution' | 'Risk' | 'Learning' | 'System'

export interface ScaffoldRoute {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly navGroup: NavGroup
  readonly purpose: string
  readonly placeholderBlocks: readonly string[]
  readonly status: 'placeholder-only'
}

export const scaffoldRoutes: readonly ScaffoldRoute[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    path: '/workspace/dashboard',
    navGroup: 'Portfolio',
    purpose: 'Show an at-a-glance operating brief for the current trading day.',
    placeholderBlocks: ['Summary', 'Signals', 'Actions', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'portfolio',
    title: 'Portfolio',
    path: '/workspace/portfolio',
    navGroup: 'Portfolio',
    purpose: 'Provide a consolidated portfolio-level view across holdings and cash.',
    placeholderBlocks: ['Summary', 'Allocation', 'History', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'positions',
    title: 'Positions',
    path: '/workspace/positions',
    navGroup: 'Portfolio',
    purpose: 'List open positions and provide placeholder controls for position review.',
    placeholderBlocks: ['Table', 'Filters', 'Actions', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'orders',
    title: 'Orders',
    path: '/workspace/orders',
    navGroup: 'Execution',
    purpose: 'Track orders and provide placeholders for order lifecycle workflows.',
    placeholderBlocks: ['Table', 'Status', 'Actions', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'risk-margin',
    title: 'Risk & Margin',
    path: '/workspace/risk-margin',
    navGroup: 'Risk',
    purpose: 'Surface risk posture and margin safety context for daily decisions.',
    placeholderBlocks: ['Summary', 'Alerts', 'Actions', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'taxes',
    title: 'Taxes',
    path: '/workspace/taxes',
    navGroup: 'Risk',
    purpose: 'Provide tax-impact awareness placeholders for portfolio decisions.',
    placeholderBlocks: ['Summary', 'Scenarios', 'Actions', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'training',
    title: 'Training Hub',
    path: '/workspace/training',
    navGroup: 'Learning',
    purpose: 'Host curated learning resources and basic in-app primers.',
    placeholderBlocks: ['Topics', 'Curated Links', 'Starter Path', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'glossary',
    title: 'Glossary',
    path: '/workspace/glossary',
    navGroup: 'Learning',
    purpose: 'Provide fast definitions for industry terms used across the app.',
    placeholderBlocks: ['Term Index', 'Definition', 'Why It Matters', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'journal',
    title: 'Journal',
    path: '/workspace/journal',
    navGroup: 'Learning',
    purpose: 'Capture trade narratives, outcomes, and learning loops over time.',
    placeholderBlocks: ['Entries', 'Prompts', 'Actions', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'automation',
    title: 'Automation',
    path: '/workspace/automation',
    navGroup: 'Execution',
    purpose: 'Define and monitor automation rules with user-controlled safeguards.',
    placeholderBlocks: ['Rules', 'Status', 'Actions', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'experiments',
    title: 'Experiments',
    path: '/workspace/experiments',
    navGroup: 'Learning',
    purpose: 'Track hypotheses, experiments, and outcomes for process improvement.',
    placeholderBlocks: ['Hypotheses', 'Runs', 'Outcomes', 'Notes'],
    status: 'placeholder-only',
  },
  {
    id: 'settings',
    title: 'Settings',
    path: '/workspace/settings',
    navGroup: 'System',
    purpose: 'Configure app preferences, profile context, and integration controls.',
    placeholderBlocks: ['Preferences', 'Connections', 'Actions', 'Notes'],
    status: 'placeholder-only',
  },
]

export const defaultWorkspaceRoute = '/workspace/dashboard'
