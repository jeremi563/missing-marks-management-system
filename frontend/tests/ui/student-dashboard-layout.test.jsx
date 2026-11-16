import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../src/auth/AuthContext'
import DashboardLayout from '../../src/layouts/DashboardLayout'

afterEach(cleanup)

describe('Student DashboardLayout', () => {
  it('shows only the first name beside the profile picture', () => {
    render(
      <AuthContext.Provider value={{ user: { displayName: 'Taylor Student' } }}>
        <MemoryRouter initialEntries={['/student']}>
          <Routes>
            <Route
              path="/student"
              element={
                <DashboardLayout
                  roleLabel="Student"
                  title="Student Dashboard"
                  navigationItems={[
                    { label: 'Dashboard', to: '/student', end: true },
                    { label: 'Reports', to: '/student/reports' },
                  ]}
                />
              }
            >
              <Route index element={<p>Dashboard content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Taylor')).toBeTruthy()
    expect(screen.queryByText('Taylor Student')).toBeNull()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Reports' })).toBeTruthy()
  })
})
