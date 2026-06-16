import { describe, it, expect } from 'vitest'
import {
  validateCreateYoutuber,
  validateUpdateYoutuber,
  validateToggleYoutuber,
  type YoutuberCreateInput,
} from '../../../supabase/functions/admin-youtube-mutate/validate'

describe('admin-youtube-mutate / validateCreateYoutuber', () => {
  it('accepts valid create input', () => {
    const input: YoutuberCreateInput = {
      displayName: 'Canal Madera',
      contactEmail: 'madera@example.com',
      channelUrl: 'https://youtube.com/@canalmadera',
      payoutMethod: 'mp',
    }

    const result = validateCreateYoutuber(input)
    expect(result).toEqual({ ok: true, data: input })
  })

  it('accepts minimal valid input (displayName only)', () => {
    const input: YoutuberCreateInput = {
      displayName: 'Canal Madera',
    }

    const result = validateCreateYoutuber(input)
    expect(result).toEqual({ ok: true, data: input })
  })

  it('rejects missing displayName', () => {
    const input = {
      displayName: '',
    }

    const result = validateCreateYoutuber(input as YoutuberCreateInput)
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'display_name is required' },
    })
  })

  it('rejects invalid email format', () => {
    const input: YoutuberCreateInput = {
      displayName: 'Canal Madera',
      contactEmail: 'not-an-email',
    }

    const result = validateCreateYoutuber(input)
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'Invalid email format' },
    })
  })

  it('accepts null email', () => {
    const input: YoutuberCreateInput = {
      displayName: 'Canal Madera',
      contactEmail: null,
    }

    const result = validateCreateYoutuber(input)
    expect(result).toEqual({ ok: true, data: input })
  })

  it('rejects invalid channelUrl format', () => {
    const input: YoutuberCreateInput = {
      displayName: 'Canal Madera',
      channelUrl: 'not-a-url',
    }

    const result = validateCreateYoutuber(input)
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'Invalid channel_url format' },
    })
  })

  it('accepts null channelUrl', () => {
    const input: YoutuberCreateInput = {
      displayName: 'Canal Madera',
      channelUrl: null,
    }

    const result = validateCreateYoutuber(input)
    expect(result).toEqual({ ok: true, data: input })
  })
})

describe('admin-youtube-mutate / validateUpdateYoutuber', () => {
  it('accepts valid update input', () => {
    const result = validateUpdateYoutuber('yt-1', {
      displayName: 'Updated Name',
      contactEmail: 'new@example.com',
    })

    expect(result).toEqual({
      ok: true,
      data: { id: 'yt-1', displayName: 'Updated Name', contactEmail: 'new@example.com' },
    })
  })

  it('rejects missing id', () => {
    const result = validateUpdateYoutuber('', { displayName: 'Name' })
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'id is required for update' },
    })
  })
})

describe('admin-youtube-mutate / validateToggleYoutuber', () => {
  it('accepts valid toggle input', () => {
    const result = validateToggleYoutuber('yt-1', false)
    expect(result).toEqual({ ok: true, data: { id: 'yt-1', isActive: false } })
  })

  it('rejects missing id', () => {
    const result = validateToggleYoutuber('', true)
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'id is required for toggle' },
    })
  })
})
