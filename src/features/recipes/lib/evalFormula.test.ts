import { describe, it, expect } from 'vitest'
import { evalFormula, safeEvalFormula } from './evalFormula'

describe('evalFormula', () => {
  it('evalúa aritmética básica', () => {
    expect(evalFormula('1 + 2 * 3', {})).toBe(7)
    expect(evalFormula('(1 + 2) * 3', {})).toBe(9)
    expect(evalFormula('10 / 4', {})).toBe(2.5)
  })

  it('soporta menos unario', () => {
    expect(evalFormula('-5 + 3', {})).toBe(-2)
    expect(evalFormula('-(2 + 3)', {})).toBe(-5)
  })

  it('resuelve variables', () => {
    expect(evalFormula('largo_cm / 100', { largo_cm: 240 })).toBe(2.4)
    expect(evalFormula('a * b + c', { a: 2, b: 3, c: 4 })).toBe(10)
  })

  it('tira error ante variable desconocida o fórmula mal formada', () => {
    expect(() => evalFormula('x + 1', {})).toThrow()
    expect(() => evalFormula('1 +', {})).toThrow()
    expect(() => evalFormula('1 / 0', {})).toThrow()
  })

  it('safeEvalFormula cae al fallback si la fórmula es vacía o falla', () => {
    expect(safeEvalFormula('', { x: 1 }, 42)).toBe(42)
    expect(safeEvalFormula(null, {}, 7)).toBe(7)
    expect(safeEvalFormula('x + y', { x: 1 }, 99)).toBe(99) // y desconocida → fallback
  })

  it('safeEvalFormula devuelve el valor evaluado cuando es válido', () => {
    expect(safeEvalFormula('w * h', { w: 3, h: 5 }, 0)).toBe(15)
  })
})
