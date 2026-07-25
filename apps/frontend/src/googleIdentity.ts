const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services'
const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  logo_alignment?: 'left' | 'center'
  width?: number
}

interface GoogleAccountsIdApi {
  initialize(config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
  }): void
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void
}

interface GoogleIdentityGlobal {
  accounts: {
    id: GoogleAccountsIdApi
  }
}

declare global {
  interface Window {
    google?: GoogleIdentityGlobal
  }
}

let googleIdentityScriptPromise: Promise<void> | null = null

function getGoogleAccountsIdApi(): GoogleAccountsIdApi {
  const accountsIdApi = window.google?.accounts?.id

  if (!accountsIdApi) {
    throw new Error('Google Identity Services is not available in this browser session.')
  }

  return accountsIdApi
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise
  }

  googleIdentityScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_IDENTITY_SCRIPT_ID,
    ) as HTMLScriptElement | null
    const script = existingScript ?? document.createElement('script')

    const onLoad = () => {
      try {
        getGoogleAccountsIdApi()
        resolve()
      } catch (error) {
        reject(error)
      }
    }

    script.addEventListener('load', onLoad, {
      once: true,
    })
    script.addEventListener(
      'error',
      () => {
        reject(new Error('Failed to load Google Identity Services.'))
      },
      {
        once: true,
      },
    )

    if (!existingScript) {
      script.id = GOOGLE_IDENTITY_SCRIPT_ID
      script.src = GOOGLE_IDENTITY_SCRIPT_URL
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }).catch((error: unknown) => {
    googleIdentityScriptPromise = null
    throw error
  })

  return googleIdentityScriptPromise
}

export function initializeGoogleSignIn(
  clientId: string,
  callback: (idToken: string) => void,
  onError: (message: string) => void,
): void {
  const accountsIdApi = getGoogleAccountsIdApi()
  accountsIdApi.initialize({
    client_id: clientId,
    callback: (response) => {
      if (typeof response.credential !== 'string' || response.credential.length === 0) {
        onError('Google did not return an ID token.')
        return
      }

      callback(response.credential)
    },
  })
}

export function renderGoogleSignInButton(parent: HTMLElement): void {
  const accountsIdApi = getGoogleAccountsIdApi()
  parent.innerHTML = ''
  accountsIdApi.renderButton(parent, {
    size: 'large',
    shape: 'pill',
    text: 'signin_with',
    theme: 'outline',
    logo_alignment: 'left',
  })
}
