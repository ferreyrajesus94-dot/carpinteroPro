import { describe, it, expect } from 'vitest'
import { renderContract } from '@/features/quotes/lib/contractRenderer'

describe('renderContract', () => {
  it('reemplaza todas las variables conocidas', () => {
    const template = 'Hola {{client_name}}, tu presupuesto es {{quote_number}} por {{total}}.'
    const result = renderContract(template, {
      client_name: 'Juan',
      quote_number: 'P-0001',
      total: '$130.000',
      furniture_name: 'Mesa',
      workshop_name: 'Taller X',
      date: '13/04/2026',
    })
    expect(result).toBe('Hola Juan, tu presupuesto es P-0001 por $130.000.')
  })

  it('deja variable desconocida intacta', () => {
    const result = renderContract('Hola {{nombre_raro}}', {
      client_name: 'Ana',
      quote_number: 'P-0002',
      total: '$50.000',
      furniture_name: 'Silla',
      workshop_name: 'Taller Y',
      date: '13/04/2026',
    })
    expect(result).toBe('Hola {{nombre_raro}}')
  })

  it('template vacío devuelve string vacío', () => {
    const result = renderContract('', {
      client_name: 'Ana',
      quote_number: 'P-0003',
      total: '$0',
      furniture_name: '',
      workshop_name: '',
      date: '',
    })
    expect(result).toBe('')
  })

  it('reemplaza múltiples ocurrencias de la misma variable', () => {
    const result = renderContract('{{workshop_name}} - {{workshop_name}}', {
      client_name: '',
      quote_number: '',
      total: '',
      furniture_name: '',
      workshop_name: 'Taller ABC',
      date: '',
    })
    expect(result).toBe('Taller ABC - Taller ABC')
  })

  it('reemplaza {{furniture_name}} y {{date}}', () => {
    const result = renderContract('Mueble: {{furniture_name}} — Fecha: {{date}}', {
      client_name: '',
      quote_number: '',
      total: '',
      furniture_name: 'Ropero 2 puertas',
      workshop_name: '',
      date: '13/04/2026',
    })
    expect(result).toBe('Mueble: Ropero 2 puertas — Fecha: 13/04/2026')
  })
})
