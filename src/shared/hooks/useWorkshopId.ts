/**
 * Returns the current workshop ID.
 * Until multi-tenant auth is implemented, reads from the env variable.
 */
export function useWorkshopId(): string {
  return import.meta.env.VITE_WORKSHOP_ID as string
}
