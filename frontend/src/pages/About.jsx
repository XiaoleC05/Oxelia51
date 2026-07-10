import { useState, useEffect } from 'react'
import { fetchDeveloperProfile, adminPatchDeveloperProfile, getToken, getStoredUser } from '../api'
import './About.css'

function About() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const token = getToken()
  const user = getStoredUser()
  const isAdmin = token && user?.role === 'admin'

  const [editingBio, setEditingBio] = useState(false)
  const [editingResume, setEditingResume] = useState(false)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [resumeDraft, setResumeDraft] = useState('')
  const [avatarDraft, setAvatarDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchDeveloperProfile()
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const startEditBio = () => {
    setBioDraft(profile.bio || '')
    setEditingBio(true)
  }

  const startEditResume = () => {
    setResumeDraft(profile.resume || '')
    setEditingResume(true)
  }

  const startEditAvatar = () => {
    setAvatarDraft(profile.avatar_url || '')
    setEditingAvatar(true)
  }

  const cancelEdit = () => {
    setEditingBio(false)
    setEditingResume(false)
    setEditingAvatar(false)
  }

  const saveField = async (field, value) => {
    setSaving(true)
    try {
      const updated = await adminPatchDeveloperProfile({ [field]: value })
      setProfile(updated)
      cancelEdit()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="about-page">
        <div className="about-skeleton">
          <div className="about-skeleton-avatar skeleton" />
          <div className="about-skeleton-lines">
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            <div className="skeleton skeleton-text" style={{ width: '80%' }} />
            <div className="skeleton skeleton-text" style={{ width: '40%' }} />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="about-page">
        <p className="about-error">{error}</p>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="about-page">
      <div className="about-hero">
        <div className="about-hero-text">
          <span className="about-eyebrow">关于开发者</span>
          <h1 className="about-title">Oxelia51</h1>
          <p className="about-tagline">探索 · 创造 · 分享</p>
        </div>
        <div className="about-avatar-wrap">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="开发者头像"
              className="about-avatar"
            />
          ) : (
            <div className="about-avatar-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.42 3.58-8 8-8s8 3.58 8 8" />
              </svg>
            </div>
          )}
          {isAdmin && !editingAvatar && (
            <button className="about-edit-btn about-edit-btn--sm" onClick={startEditAvatar}>
              编辑头像
            </button>
          )}
          {isAdmin && editingAvatar && (
            <div className="about-inline-edit">
              <input
                type="text"
                value={avatarDraft}
                onChange={(e) => setAvatarDraft(e.target.value)}
                placeholder="头像图片 URL"
              />
              <div className="about-inline-edit-actions">
                <button
                  className="about-save-btn"
                  onClick={() => saveField('avatar_url', avatarDraft)}
                  disabled={saving}
                >
                  {saving ? '…' : '保存'}
                </button>
                <button className="about-cancel-btn" onClick={cancelEdit} disabled={saving}>
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="about-section">
        <div className="about-section-header">
          <h2>简介</h2>
          {isAdmin && !editingBio && (
            <button className="about-edit-btn" onClick={startEditBio}>
              编辑
            </button>
          )}
        </div>
        {editingBio ? (
          <div className="about-inline-edit">
            <textarea
              className="about-edit-textarea"
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
              rows={6}
              placeholder="开发者简介…"
            />
            <div className="about-inline-edit-actions">
              <button
                className="about-save-btn"
                onClick={() => saveField('bio', bioDraft)}
                disabled={saving}
              >
                {saving ? '保存中…' : '保存'}
              </button>
              <button className="about-cancel-btn" onClick={cancelEdit} disabled={saving}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="about-prose">
            {profile.bio ? profile.bio : <span className="about-muted">暂无简介。</span>}
          </div>
        )}
      </section>

      <section className="about-section">
        <div className="about-section-header">
          <h2>履历</h2>
          {isAdmin && !editingResume && (
            <button className="about-edit-btn" onClick={startEditResume}>
              编辑
            </button>
          )}
        </div>
        {editingResume ? (
          <div className="about-inline-edit">
            <textarea
              className="about-edit-textarea about-edit-textarea--tall"
              value={resumeDraft}
              onChange={(e) => setResumeDraft(e.target.value)}
              rows={14}
              placeholder="开发者履历…"
            />
            <div className="about-inline-edit-actions">
              <button
                className="about-save-btn"
                onClick={() => saveField('resume', resumeDraft)}
                disabled={saving}
              >
                {saving ? '保存中…' : '保存'}
              </button>
              <button className="about-cancel-btn" onClick={cancelEdit} disabled={saving}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="about-prose">
            {profile.resume ? profile.resume : <span className="about-muted">暂无履历。</span>}
          </div>
        )}
      </section>
    </div>
  )
}

export default About
