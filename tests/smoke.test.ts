import { describe, expect, it } from 'vitest'
import { dictionaries } from '../src/i18n'

function keys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('i18n', () => {
  it('en and es have identical keys', () => {
    expect(keys(dictionaries.es).sort()).toEqual(keys(dictionaries.en).sort())
  })
})
