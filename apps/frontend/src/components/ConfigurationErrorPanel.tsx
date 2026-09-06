import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'

export interface ConfigurationErrorPanelProps {
  message?: string
  instructions?: readonly string[]
}

const DEFAULT_INSTRUCTIONS = [
  'Open your environment configuration file (.env) in the project root.',
  'Set server-side APP_MODE=local for local household profile execution, or APP_MODE=hosted for multi-tenant SaaS mode. Do not prefix this value with VITE_.',
  'Ensure database environment variables (DATABASE_URL) are configured.',
  'Restart the application server to apply configuration changes.',
]

export const ConfigurationErrorPanel: React.FC<ConfigurationErrorPanelProps> = ({
  message = 'Application deployment mode (server-side APP_MODE) is not configured or initialization failed.',
  instructions = DEFAULT_INSTRUCTIONS,
}) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-2xl border-state-error/30 shadow-lg">
        <CardHeader className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-state-error/10 text-state-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-text-strong">
                Initialization & Configuration Error
              </CardTitle>
              <CardDescription className="text-sm text-text-muted">
                The application cannot start until configuration is complete.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertTitle className="font-semibold">Configuration Required</AlertTitle>
            <AlertDescription className="mt-1 text-sm">{message}</AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-strong">
              How to Resolve This Issue:
            </h3>
            <ol className="list-decimal space-y-2.5 pl-5 text-sm text-text-muted">
              {instructions.map((instruction, index) => (
                <li key={index} className="leading-relaxed">
                  {instruction}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-md border border-border-subtle bg-surface-emphasis/50 p-4 font-mono text-xs text-text-strong">
            <p className="font-semibold text-text-muted"># Example .env configuration</p>
            <p className="mt-1 text-action-primary">APP_MODE=local</p>
            <p className="text-text-muted"># or APP_MODE=hosted</p>
            <p className="mt-2 text-text-muted"># Note: use APP_MODE, not VITE_APP_MODE</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
