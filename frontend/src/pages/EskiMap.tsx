import { Navigate, useLocation } from 'react-router'

/** Eski `/map?viloyat=..&tuman=..` havolalari — parametrlari bilan `/` ga */
export function EskiMap() {
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: '/', search, hash }} replace />
}
