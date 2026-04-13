import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchWorkshopSettings,
  upsertWorkshopSettings,
} from '../api/workshopSettings'
import type { WorkshopSettingsInsert } from '../api/workshopSettings'

const SETTINGS_KEY = 'workshop_settings'

export function useWorkshopSettings(workshopId: string) {
  return useQuery({
    queryKey: [SETTINGS_KEY, workshopId],
    queryFn: () => fetchWorkshopSettings(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useUpsertWorkshopSettings(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: Omit<WorkshopSettingsInsert, 'workshop_id'>) =>
      upsertWorkshopSettings({ ...settings, workshop_id: workshopId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY, workshopId] }),
  })
}
