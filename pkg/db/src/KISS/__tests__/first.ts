import { describe, it, expect } from 'vitest'
import { getDB } from '../orders'

describe('KISS test suite', () => {
  it('should pass a simple assertion', () => {
    expect(true).toBe(true)
  })

  it('should correctly add two numbers', () => {
    expect(2 + 2).toBe(4)
  })

  it('should return a database instance', async () => {
    const db = await getDB('testdb')
    expect(db).toBeDefined()
  })
})
