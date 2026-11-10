

import { useEffect, useState } from 'react'
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Building2,
  Hash,
  CalendarDays,
  RefreshCw,
} from 'lucide-react'
import { getStudentProfile } from '../../api/student'
import '../../styles/StudentProfile.css'

function StudentProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await getStudentProfile()
      setProfile(response?.data?.data ?? response?.data ?? null)
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to load your profile.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const getFullName = () => {
    if (!profile) return 'Student'

    if (profile.fullName) return profile.fullName

    const firstName = profile.firstName || profile.first_name || ''
    const lastName = profile.lastName || profile.last_name || ''

    return `${firstName} ${lastName}`.trim() || 'Student'
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
          <button onClick={loadProfile}>
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
          <h2>{getFullName()}</h2>
          <p>
            {getValue(
              profile.registrationNumber,
              profile.registration_number,
              profile.studentNumber,
              profile.student_number
            )}
          </p>
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
            value={getFullName()}
          />

          <ProfileField
            icon={<Mail />}
            label="Email Address"
            value={getValue(profile.email)}
          />

          <ProfileField
            icon={<Phone />}
            label="Phone Number"
            value={getValue(profile.phone, profile.phoneNumber, profile.phone_number)}
          />

          <ProfileField
            icon={<Hash />}
            label="Registration Number"
            value={getValue(
              profile.registrationNumber,
              profile.registration_number,
              profile.studentNumber,
              profile.student_number
            )}
          />
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-section-heading">
          <GraduationCap size={20} />
          <h3>Academic Information</h3>
        </div>

        <div className="profile-grid">
          <ProfileField
            icon={<GraduationCap />}
            label="Course / Programme"
            value={getValue(
              profile.programme?.name,
              profile.programmeName,
              profile.programme_name,
              profile.course?.name,
              profile.courseName
            )}
          />

          <ProfileField
            icon={<Building2 />}
            label="Department"
            value={getValue(
              profile.department?.name,
              profile.departmentName,
              profile.department_name
            )}
          />

          <ProfileField
            icon={<CalendarDays />}
            label="Year of Study"
            value={getValue(profile.yearOfStudy, profile.year_of_study)}
          />

          <ProfileField
            icon={<CalendarDays />}
            label="Academic Period"
            value={getValue(
              profile.academicPeriod?.name,
              profile.academicPeriodName,
              profile.academic_period_name
            )}
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
