import { createBrowserRouter, Navigate, useLocation } from 'react-router'
import { MapLayout } from '@/layouts/MapLayout'
import { MapPage } from '@/pages/MapPage'
import { NotFound } from '@/pages/NotFound'

/** Eski `/map?viloyat=..&tuman=..` havolalari — parametrlari bilan `/` ga */
function EskiMap() {
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: '/', search, hash }} replace />
}

export const router = createBrowserRouter([
  {
    element: <MapLayout />,
    children: [{ path: '/', element: <MapPage /> }],
  },
  { path: '/map', element: <EskiMap /> },
  { path: '*', element: <NotFound /> },
])
