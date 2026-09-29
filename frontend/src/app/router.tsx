import { createBrowserRouter, Navigate } from 'react-router'
import { MapLayout } from '@/layouts/MapLayout'
import { MapPage } from '@/pages/MapPage'
import { NotFound } from '@/pages/NotFound'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/map" replace /> },
  {
    element: <MapLayout />,
    children: [{ path: '/map', element: <MapPage /> }],
  },
  { path: '*', element: <NotFound /> },
])
