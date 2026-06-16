'use client'
/**
 * usePresets — single source of truth for the session-preset library.
 *
 * Presets are stored in the DB and served by `sessionPresetsApi`
 * (GET /api/session-presets, optionally scoped to a programme). This hook
 * loads them and exposes a normalized, UI-friendly shape. When the programme
 * isn't saved yet or the API fails, it falls back to the static defaults that
 * mirror the built-in rows seeded server-side (SessionPresetSeeder).
 *
 * Presets are **type-free**: a preset is just a name + color + durationKind.
 * `durationKind` is always normalized to 'day' | 'range' (legacy 'week' /
 * 'custom' collapse to 'range').
 */
import { useEffect, useState } from 'react'
import { sessionPresetsApi } from '@/lib/api'

export type PresetDurationKind = 'day' | 'range'

export interface BuilderPreset {
  /** DB id when loaded from the API; absent for the static fallback. */
  id?: number
  title: string
  durationKind: PresetDurationKind
  /** Hex color for the preset pill + the session bar. */
  color: string
}

/** Neutral fallback color when a preset has none. */
export const DEFAULT_COLOR = '#10B981'

/** Collapse any raw/legacy durationKind to the canonical 'day' | 'range'. */
export const normalizeDurationKind = (kind?: string): PresetDurationKind =>
  kind === 'day' ? 'day' : 'range'

/**
 * Static fallback — mirrors the built-in presets seeded in the DB
 * (see SessionPresetSeeder). Used before a programme is saved or if the
 * presets endpoint is unreachable.
 */
export const DEFAULT_PRESETS: BuilderPreset[] = [
  { title: 'Candidature',  durationKind: 'range', color: '#0EA5E9' },
  { title: 'Présélection', durationKind: 'range', color: '#F59E0B' },
  { title: 'Pitch Day',    durationKind: 'day',   color: '#EF4444' },
  { title: 'Onboarding',   durationKind: 'day',   color: '#10B981' },
  { title: 'Incubation',   durationKind: 'range', color: '#A855F7' },
  { title: 'Demo Day',     durationKind: 'day',   color: '#F97316' },
  { title: 'Formation',    durationKind: 'day',   color: '#6366F1' },
]

interface RawPreset {
  id: number
  title: string
  color?: string
  durationKind?: string
  sortOrder?: number
}

/**
 * Loads the session presets (global + programme-local). Returns the static
 * defaults until the API responds; keeps them if the call fails or is empty.
 */
export function usePresets(programmeId?: number): BuilderPreset[] {
  const [presets, setPresets] = useState<BuilderPreset[]>(DEFAULT_PRESETS)

  useEffect(() => {
    let cancelled = false
    sessionPresetsApi.list(programmeId)
      .then((r) => {
        const raw = (r.data ?? []) as RawPreset[]
        if (cancelled || raw.length === 0) return
        const mapped = [...raw]
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map<BuilderPreset>((p) => ({
            id: p.id,
            title: p.title,
            durationKind: normalizeDurationKind(p.durationKind),
            color: p.color || DEFAULT_COLOR,
          }))
        setPresets(mapped)
      })
      .catch(() => { /* keep the static fallback */ })
    return () => { cancelled = true }
  }, [programmeId])

  return presets
}
