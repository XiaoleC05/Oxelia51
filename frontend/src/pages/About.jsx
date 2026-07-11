import { useState, useEffect, useRef } from 'react'
import { fetchDeveloperProfile, adminPatchDeveloperProfile, adminUploadAvatar, getToken, getStoredUser } from '../api'
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
  const [avatarMode, setAvatarMode] = useState('upload')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef(null)
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
    setAvatarFile(null)
    setAvatarPreview(profile.avatar_url || '')
    setAvatarError('')
    setAvatarMode('upload')
    setEditingAvatar(true)
  }

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('文件不能超过 10MB')
      return
    }
    setAvatarFile(file)
    setAvatarError('')
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      setAvatarError('请先选择文件')
      return
    }
    setSaving(true)
    setAvatarError('')
    try {
      const { url } = await adminUploadAvatar(avatarFile)
      const updated = await adminPatchDeveloperProfile({ avatar_url: url })
      setProfile(updated)
      cancelEdit()
    } catch (err) {
      setAvatarError(err.message)
    } finally {
      setSaving(false)
    }
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
          <p className="about-tagline">集成·简洁·高效</p>
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
            <div className="about-avatar-edit">
              <div className="about-avatar-edit-tabs">
                <button
                  className={`about-avatar-edit-tab ${avatarMode === 'upload' ? 'about-avatar-edit-tab--active' : ''}`}
                  onClick={() => setAvatarMode('upload')}
                >
                  上传文件
                </button>
                <button
                  className={`about-avatar-edit-tab ${avatarMode === 'url' ? 'about-avatar-edit-tab--active' : ''}`}
                  onClick={() => setAvatarMode('url')}
                >
                  图片 URL
                </button>
              </div>

              {avatarError && <p className="about-avatar-edit-error">{avatarError}</p>}

              {avatarPreview && (
                <div className="about-avatar-edit-preview">
                  <img src={avatarPreview} alt="预览" />
                </div>
              )}

              {avatarMode === 'upload' ? (
                <label className="about-avatar-edit-file">
                  <input
                    type="file"
                    accept="image/*"
                    ref={avatarInputRef}
                    onChange={handleAvatarFileChange}
                  />
                  <span>{avatarFile ? avatarFile.name : '选择图片（最大 10MB）'}</span>
                </label>
              ) : (
                <input
                  type="text"
                  value={avatarDraft}
                  onChange={(e) => { setAvatarDraft(e.target.value); setAvatarPreview(e.target.value) }}
                  placeholder="头像图片 URL"
                />
              )}

              <div className="about-inline-edit-actions">
                {avatarMode === 'upload' ? (
                  <button
                    className="about-save-btn"
                    onClick={handleAvatarUpload}
                    disabled={saving || !avatarFile}
                  >
                    {saving ? '上传中…' : '上传并保存'}
                  </button>
                ) : (
                  <button
                    className="about-save-btn"
                    onClick={() => saveField('avatar_url', avatarDraft)}
                    disabled={saving}
                  >
                    {saving ? '保存中…' : '保存'}
                  </button>
                )}
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
