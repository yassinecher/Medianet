'use client'
import { useEffect, useState } from 'react'
import { catalogApi } from '@/lib/api'

export interface CatalogOption { value: string; label: string; active?: boolean }

/**
 * Fetch an admin-managed reference list (e.g. "organization_type"). Returns
 * ACTIVE options, sorted. Falls back to the provided defaults if the catalogue
 * is unreachable so forms never break.
 */
export function useCatalog(category: string, fallback: { value: string; label: string }[] = []) {
  const [options, setOptions] = useState<CatalogOption[]>(fallback)
  useEffect(() => {
    let cancelled = false
    catalogApi.list(category)
      .then((r) => {
        if (cancelled) return
        const rows: CatalogOption[] = (r.data ?? []).filter((o: CatalogOption) => o.active !== false)
        if (rows.length) setOptions(rows)
      })
      .catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [category])
  return options
}
