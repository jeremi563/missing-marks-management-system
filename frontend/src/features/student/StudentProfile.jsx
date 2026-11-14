

import { useCallback, useEffect, useState } from 'react'
import {
  User,
  Mail,
  Hash,
  RefreshCw,
} from 'lucide-react'
import { getStudentProfile } from '../../api/student'
import { normalizeStudentProfile } from './profileData'
import '../../styles/StudentProfile.css'

function StudentProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadProfile = useCallback(async () => {
    const response = await getStudentProfile()
    return normalizeStudentProfile(response)
  }, [])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const nextProfile = await loadProfile()
        if (active) {
          setProfile(nextProfile)
          setError('')
        }
      } catch (err) {
        if (active) {
          setError(err.response?.data?.message || 'Failed to load your profile.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [loadProfile])

  const handleRetry = () => {
    setLoading(true)
    setError('')
    loadProfile()
      .then(setProfile)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load your profile.'))
      .finally(() => setLoading(false))
  }

  const getValue = (...values) => {
    return values.find(
      (value) => value !== undefined && value !== null && value !== ''
    ) || 'Not provided'
  }

  if (loading) {
    return (
      <div className="student-profile">
        <div className="profile-loading">Loading your profile...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="student-profile">
        <div className="profile-error">
          <p>{error}</p>
          <button onClick={handleRetry}>
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="student-profile">
        <div className="profile-error">
          No profile information is available.
        </div>
      </div>
    )
  }

  return (
    <div className="student-profile">
      <div className="profile-header">
        <div>
          <h1>My Profile</h1>
          <p>View your personal and academic information.</p>
        </div>
      </div>

      <section className="profile-summary">
        <div className="profile-avatar">
          <User size={35} />
        </div>

        <div>
          <h2>{profile.displayName}</h2>
          <p>{getValue(profile.studentNumber)}</p>
          <span className="profile-role">Student</span>
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-section-heading">
          <User size={20} />
          <h3>Personal Information</h3>
        </div>

        <div className="profile-grid">
          <ProfileField
            icon={<User />}
            label="Full Name"
            value={profile.displayName}
          />

          <ProfileField
            icon={<Mail />}
            label="Email Address"
            value={getValue(profile.email)}
          />

          <ProfileField
            icon={<Hash />}
            label="Registration Number"
            value={getValue(profile.studentNumber)}
          />
        </div>
      </section>
    </div>
  )
}

function ProfileField({ icon, label, value }) {
  return (
    <div className="profile-field">
      <div className="profile-field-icon">{icon}</div>

      <div>
        <span>{label}</span>
        <p>{value}</p>
      </div>
    </div>
  )
}

export default StudentProfile
