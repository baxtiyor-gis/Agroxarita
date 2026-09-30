import { createBrowserRouter } from 'react-router'
import { MapLayout } from '@/layouts/MapLayout'
import { EskiMap } from '@/pages/EskiMap'
import { MapPage } from '@/pages/MapPage'
import { NotFound } from '@/pages/NotFound'

export const router = createBrowserRouter([
  {
    element: <MapLayout />,
    children: [{ path: '/', element: <MapPage /> }],
  },
  { path: '/map', element: <EskiMap /> },
  { path: '*', element: <NotFound /> },
])
