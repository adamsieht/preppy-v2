import { describe, it, expect } from 'vitest'
import { deepMerge } from '../../main/services/config.service'

describe('deepMerge', () => {
  it('returns base values when overrides is empty', () => {
    const base = { a: 1, b: 'hello' }
    expect(deepMerge(base, {})).toEqual({ a: 1, b: 'hello' })
  })

  it('overrides a top-level scalar', () => {
    const base = { a: 1, b: 2 }
    expect(deepMerge(base, { b: 99 })).toEqual({ a: 1, b: 99 })
  })

  it('deep-merges nested objects without clobbering siblings', () => {
    const base = { printer: { device: '/dev/lp0', simulate: false, zplTemplateDir: 'resources/zpl' } }
    const overrides = { printer: { simulate: true } }
    expect(deepMerge(base, overrides)).toEqual({
      printer: { device: '/dev/lp0', simulate: true, zplTemplateDir: 'resources/zpl' },
    })
  })

  it('handles multiple nested sections independently', () => {
    const base = { printer: { device: '/dev/lp0' }, wifi: { interface: 'wlan0' } }
    const overrides = { wifi: { interface: 'eth0' } }
    const result = deepMerge(base, overrides)
    expect(result.printer.device).toBe('/dev/lp0')
    expect(result.wifi.interface).toBe('eth0')
  })

  it('does not mutate the base object', () => {
    const base = { a: 1, nested: { b: 2 } }
    deepMerge(base, { nested: { b: 99 } })
    expect(base.nested.b).toBe(2)
  })

  it('ignores undefined override values', () => {
    const base = { a: 1 }
    expect(deepMerge(base, { a: undefined })).toEqual({ a: 1 })
  })
})
