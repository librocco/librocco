import { describe, it, expect } from 'vitest'

describe('KISS test suite', () => {
  it('should pass a simple assertion', () => {
    expect(true).toBe(true)
  })

  it('should correctly add two numbers', () => {
    expect(2 + 2).toBe(4)
  })
})
