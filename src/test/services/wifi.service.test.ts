import { describe, it, expect } from 'vitest'
import { SSID_RE, PASS_RE } from '../../main/services/wifi.service'

describe('SSID_RE', () => {
  it('accepts standard alphanumeric SSID', () => {
    expect(SSID_RE.test('MyNetwork')).toBe(true)
  })

  it('accepts SSID with spaces', () => {
    expect(SSID_RE.test('My Home Network')).toBe(true)
  })

  it('accepts SSID with hyphens, dots, and @', () => {
    expect(SSID_RE.test('My-Network.2.4@home')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(SSID_RE.test('')).toBe(false)
  })

  it('rejects SSID longer than 64 chars', () => {
    expect(SSID_RE.test('a'.repeat(65))).toBe(false)
  })

  it('rejects SSID with special chars like #', () => {
    expect(SSID_RE.test('Net#work!')).toBe(false)
  })

  it('accepts exactly 64 chars', () => {
    expect(SSID_RE.test('a'.repeat(64))).toBe(true)
  })
})

describe('PASS_RE', () => {
  it('accepts valid 8-char password', () => {
    expect(PASS_RE.test('password')).toBe(true)
  })

  it('accepts complex password with symbols', () => {
    expect(PASS_RE.test('P@ssw0rd!#$%')).toBe(true)
  })

  it('rejects password shorter than 8 chars', () => {
    expect(PASS_RE.test('short')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(PASS_RE.test('')).toBe(false)
  })

  it('rejects password longer than 63 chars', () => {
    expect(PASS_RE.test('a'.repeat(64))).toBe(false)
  })

  it('accepts exactly 63-char password', () => {
    expect(PASS_RE.test('a'.repeat(63))).toBe(true)
  })

  it('rejects password with non-printable ASCII (tab)', () => {
    expect(PASS_RE.test('pass\tword')).toBe(false)
  })
})
