import React from 'react'
import { Navigate } from 'react-router-dom'
import { getUser } from '../services/api.js'

export default function ProtectedRoute({ element, roles }) {
  const user = getUser()
  if (!user || !localStorage.getItem('token')) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />
  return element
}
