import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getAppMode,
  getAuthConfiguration,
  getJwtSecret,
  getRefreshTokenCookieOptions,
  DEFAULT_LOCAL_SESSION_TTL_DAYS,
  DEFAULT_HOSTED_SESSION_TTL_DAYS,
  DEFAULT_ACCESS_TOKEN_TTL_MINUTES,
  DEV_JWT_SECRET,
} from './index.js'

describe('auth configuration and mode helpers', () => {
  describe('getJwtSecret', () => {
    it('returns default dev secret when JWT_SECRET is unset', () => {
      assert.equal(getJwtSecret({}), DEV_JWT_SECRET)
    })

    it('returns configured secret when JWT_SECRET is set', () => {
      assert.equal(
        getJwtSecret({ JWT_SECRET: '  custom-secret-key  ' }),
        'custom-secret-key',
      )
    })
  })

  describe('getAppMode', () => {
    it('returns null when APP_MODE is unset or empty', () => {
      assert.equal(getAppMode({}), null)
      assert.equal(getAppMode({ APP_MODE: '   ' }), null)
    })

    it('returns null when APP_MODE is invalid', () => {
      assert.equal(getAppMode({ APP_MODE: 'invalid' }), null)
      assert.equal(getAppMode({ APP_MODE: 'development' }), null)
    })

    it('parses APP_MODE case-insensitively for valid values', () => {
      assert.equal(getAppMode({ APP_MODE: 'local' }), 'local')
      assert.equal(getAppMode({ APP_MODE: 'LOCAL' }), 'local')
      assert.equal(getAppMode({ APP_MODE: 'hosted' }), 'hosted')
      assert.equal(getAppMode({ APP_MODE: 'Hosted  ' }), 'hosted')
    })
  })

  describe('getAuthConfiguration', () => {
    it('uses local defaults when APP_MODE=local', () => {
      const config = getAuthConfiguration({ APP_MODE: 'local' })

      assert.equal(config.appMode, 'local')
      assert.equal(config.sessionTtlDays, DEFAULT_LOCAL_SESSION_TTL_DAYS)
      assert.equal(config.accessTokenTtlMinutes, DEFAULT_ACCESS_TOKEN_TTL_MINUTES)
      assert.equal(
        config.refreshTokenMaxAgeSeconds,
        DEFAULT_LOCAL_SESSION_TTL_DAYS * 24 * 60 * 60,
      )
      assert.equal(config.accessTokenExpiresIn, '15m')
      assert.equal(config.refreshTokenExpiresIn, '365d')
    })

    it('uses hosted defaults when APP_MODE=hosted', () => {
      const config = getAuthConfiguration({ APP_MODE: 'hosted' })

      assert.equal(config.appMode, 'hosted')
      assert.equal(config.sessionTtlDays, DEFAULT_HOSTED_SESSION_TTL_DAYS)
      assert.equal(config.accessTokenTtlMinutes, DEFAULT_ACCESS_TOKEN_TTL_MINUTES)
      assert.equal(
        config.refreshTokenMaxAgeSeconds,
        DEFAULT_HOSTED_SESSION_TTL_DAYS * 24 * 60 * 60,
      )
      assert.equal(config.accessTokenExpiresIn, '15m')
      assert.equal(config.refreshTokenExpiresIn, '7d')
    })

    it('allows custom SESSION_TTL_DAYS and ACCESS_TOKEN_TTL_MINUTES override', () => {
      const config = getAuthConfiguration({
        APP_MODE: 'hosted',
        SESSION_TTL_DAYS: '30',
        ACCESS_TOKEN_TTL_MINUTES: '60',
      })

      assert.equal(config.sessionTtlDays, 30)
      assert.equal(config.accessTokenTtlMinutes, 60)
      assert.equal(config.refreshTokenMaxAgeSeconds, 30 * 24 * 60 * 60)
      assert.equal(config.accessTokenExpiresIn, '60m')
      assert.equal(config.refreshTokenExpiresIn, '30d')
    })

    it('ignores invalid numeric overrides and falls back to defaults', () => {
      const config = getAuthConfiguration({
        APP_MODE: 'hosted',
        SESSION_TTL_DAYS: '-5',
        ACCESS_TOKEN_TTL_MINUTES: 'invalid',
      })

      assert.equal(config.sessionTtlDays, DEFAULT_HOSTED_SESSION_TTL_DAYS)
      assert.equal(config.accessTokenTtlMinutes, DEFAULT_ACCESS_TOKEN_TTL_MINUTES)
    })
  })

  describe('getRefreshTokenCookieOptions', () => {
    it('sets maxAge matching session TTL and secure false in dev', () => {
      const options = getRefreshTokenCookieOptions({
        APP_MODE: 'hosted',
        NODE_ENV: 'development',
      })

      assert.equal(options.httpOnly, true)
      assert.equal(options.maxAge, DEFAULT_HOSTED_SESSION_TTL_DAYS * 24 * 60 * 60)
      assert.equal(options.path, '/')
      assert.equal(options.sameSite, 'lax')
      assert.equal(options.secure, false)
    })

    it('sets secure true in production', () => {
      const options = getRefreshTokenCookieOptions({
        APP_MODE: 'hosted',
        NODE_ENV: 'production',
      })

      assert.equal(options.secure, true)
    })

    it('allows custom maxAge override', () => {
      const options = getRefreshTokenCookieOptions(
        { APP_MODE: 'local' },
        3600,
      )

      assert.equal(options.maxAge, 3600)
    })
  })
})
