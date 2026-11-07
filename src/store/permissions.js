import { useLocation } from 'react-router-dom'
import { useUser } from './auth'
import { useCollection } from './db'
import { can } from '../config/permissions'

// { edit, delete } for the signed-in user on a page (default: the current page).
export function useCan(path) {
  const user = useUser()
  const perms = useCollection('permissions')
  const { pathname } = useLocation()
  const map = perms[0]?.map
  const p = path || pathname
  return { edit: can(map, user?.role, 'edit', p), delete: can(map, user?.role, 'delete', p) }
}
