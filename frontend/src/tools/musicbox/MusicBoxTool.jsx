import { useEffect, useState, useCallback, useRef } from 'react'
import { apiProxy } from '../../api'
import './MusicBoxTool.css'

function SearchIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>)
}
function PlayIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4l15 8-15 8z" /></svg>)
}
function PauseIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="6" height="16" rx="1" /><rect x="14" y="4" width="6" height="16" rx="1" /></svg>)
}
function SkipForwardIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>)
}
function SkipBackIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" /></svg>)
}
function Volume2Icon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>)
}
function ListMusicIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>)
}
function PlusIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>)
}
function Trash2Icon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>)
}
function SettingsIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>)
}
function XIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)
}
function MusicIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>)
}
function GripIcon() {
  return (<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" opacity="0.35"><circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" /></svg>)
}

function fmtDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function buildTrackKey(t) {
  return `${t.platform}:${t.platform_song_id || t.song_id}`
}

export default function MusicBoxTool() {
  const [viewMode, setViewMode] = useState('search')
  const audioRef = useRef(null)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => { const s = localStorage.getItem('mb_volume'); return s != null ? parseFloat(s) : 0.7 })
  const [playUrl, setPlayUrl] = useState(null)
  const [queue, setQueue] = useState([])
  const [queueIdx, setQueueIdx] = useState(-1)
  const [queueVisible, setQueueVisible] = useState(false)
  const progressRef = useRef(null)
  const seeking = useRef(false)
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('kugou')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [playlists, setPlaylists] = useState([])
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [playlistSongs, setPlaylistSongs] = useState([])
  const [playlistSongsLoading, setPlaylistSongsLoading] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [creatingPlaylist, setCreatingPlaylist] = useState(false)
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(null)
  const [cookie, setCookie] = useState('')
  const [credStatus, setCredStatus] = useState(null)
  const [savingCred, setSavingCred] = useState(false)
  const [credError, setCredError] = useState('')
  const [credLoading, setCredLoading] = useState(false)
  const [showCookie, setShowCookie] = useState(false)
  const [hasSavedCookie, setHasSavedCookie] = useState(false)
  const [error, setError] = useState('')

  const playTrack = useCallback(async (track) => {
    try {
      const data = await apiProxy('musicbox', `api/play/${track.platform}/${track.platform_song_id || track.song_id}`)
      const url = data?.url || data?.play_url
      if (!url) throw new Error('未获取到播放地址')
      setPlayUrl(url)
      setCurrentTrack(track)
      setIsPlaying(true)
    } catch (err) { setError(err.message) }
  }, [])

  const playNext = useCallback(() => {
    if (queue.length === 0) { setIsPlaying(false); return }
    const next = (queueIdx + 1) % queue.length
    setQueueIdx(next)
    playTrack(queue[next])
  }, [queue, queueIdx, playTrack])

  useEffect(() => {
    const audio = new Audio()
    audio.volume = volume
    audio.preload = 'auto'
    audioRef.current = audio
    const onTime = () => { if (!seeking.current) setCurrentTime(audio.currentTime) }
    const onMeta = () => setDuration(audio.duration)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnd = () => playNext()
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('error', () => { setIsPlaying(false) })
    return () => { audio.pause(); audio.src = '' }
  }, [])

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])
  useEffect(() => { if (playUrl && audioRef.current) { audioRef.current.src = playUrl; audioRef.current.play().catch(() => {}) } }, [playUrl])

  const togglePlay = useCallback(() => {
    const a = audioRef.current
    if (!a || !a.src || a.src === window.location.href) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }, [])

  const playPrev = useCallback(() => {
    if (queue.length === 0) return
    const a = audioRef.current
    if (a && a.currentTime > 3) { a.currentTime = 0; return }
    const prev = queueIdx <= 0 ? queue.length - 1 : queueIdx - 1
    setQueueIdx(prev)
    playTrack(queue[prev])
  }, [queue, queueIdx, playTrack])

  const addToQueue = useCallback((track) => {
    setQueue((prev) => {
      const key = buildTrackKey(track)
      if (prev.length > 0 && buildTrackKey(prev[prev.length - 1]) === key) return prev
      return [...prev, track]
    })
  }, [])

  const playNow = useCallback(async (track) => {
    setQueue((prev) => [...prev, track])
    await playTrack(track)
    setQueue((prev) => { setQueueIdx(prev.length - 1); return prev })
  }, [playTrack])

  const removeFromQueue = useCallback((idx) => {
    setQueue((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      setQueueIdx((qi) => { if (idx < qi) return qi - 1; if (idx === qi && next.length === 0) return -1; if (idx === qi) return Math.min(qi, next.length - 1); return qi })
      return next
    })
  }, [])

  const handleProgressClick = useCallback((e) => {
    const rect = progressRef.current?.getBoundingClientRect()
    if (!rect || !audioRef.current) return
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = ratio * (duration || 0)
    setCurrentTime(ratio * (duration || 0))
  }, [duration])

  const doSearch = useCallback(async (e) => {
    if (e) e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchResults([])
    try {
      const data = await apiProxy('musicbox', `api/search?q=${encodeURIComponent(query.trim())}&platform=${platform}`)
      const results = data?.results || data?.songs || data?.data || []
      setSearchResults(Array.isArray(results) ? results : [])
    } catch (err) { setSearchError(err.message) } finally { setSearching(false) }
  }, [query, platform])

  const loadPlaylists = useCallback(async () => {
    setPlaylistsLoading(true)
    try { const data = await apiProxy('musicbox', 'api/playlists'); setPlaylists(Array.isArray(data) ? data : (data?.playlists || [])) } catch { }
    finally { setPlaylistsLoading(false) }
  }, [])

  const loadPlaylistSongs = useCallback(async (pl) => {
    setPlaylistSongsLoading(true)
    try { const data = await apiProxy('musicbox', `api/playlists/${pl.id}/songs`); setPlaylistSongs(Array.isArray(data) ? data : (data?.songs || [])) } catch { }
    finally { setPlaylistSongsLoading(false) }
  }, [])

  const createPlaylist = useCallback(async () => {
    if (!newPlaylistName.trim()) return
    setCreatingPlaylist(true)
    try { await apiProxy('musicbox', 'api/playlists', { method: 'POST', body: JSON.stringify({ name: newPlaylistName.trim() }) }); setNewPlaylistName(''); await loadPlaylists() } catch (err) { setError(err.message) } finally { setCreatingPlaylist(false) }
  }, [newPlaylistName, loadPlaylists])

  const deletePlaylist = useCallback(async (id) => {
    try { await apiProxy('musicbox', `api/playlists/${id}`, { method: 'DELETE' }); if (selectedPlaylist?.id === id) setSelectedPlaylist(null); await loadPlaylists() } catch (err) { setError(err.message) }
  }, [loadPlaylists, selectedPlaylist])

  const addSongToPlaylist = useCallback(async (playlistId, track) => {
    try {
      await apiProxy('musicbox', `api/playlists/${playlistId}/songs`, { method: 'POST', body: JSON.stringify({ title: track.title || track.name, artist: track.artist || track.singer || '', album: track.album || '', duration: track.duration || 0, platform: track.platform, platform_song_id: track.platform_song_id || track.song_id || track.id }) })
      if (selectedPlaylist?.id === playlistId) await loadPlaylistSongs(selectedPlaylist)
      setAddToPlaylistOpen(null)
    } catch (err) { setError(err.message) }
  }, [selectedPlaylist, loadPlaylistSongs])

  const removeSongFromPlaylist = useCallback(async (playlistId, songIdx) => {
    try { const song = playlistSongs[songIdx]; const songId = song.platform_song_id || song.song_id || songIdx; await apiProxy('musicbox', `api/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE' }); setPlaylistSongs((prev) => prev.filter((_, i) => i !== songIdx)) } catch (err) { setError(err.message) }
  }, [playlistSongs])

  const moveSong = useCallback((fromIdx, toIdx) => { if (fromIdx === toIdx) return; setPlaylistSongs((prev) => { const next = [...prev]; const [moved] = next.splice(fromIdx, 1); next.splice(toIdx, 0, moved); return next }) }, [])

  const loadCredStatus = useCallback(async () => {
    setCredLoading(true)
    try { const data = await apiProxy('musicbox', 'api/credentials/status'); setCredStatus(data); setHasSavedCookie(!!(data?.connected)) } catch { }
    finally { setCredLoading(false) }
  }, [])

  const saveCredentials = useCallback(async (e) => {
    e.preventDefault()
    if (!cookie.trim()) return
    setSavingCred(true)
    setCredError('')
    try { await apiProxy('musicbox', 'api/credentials', { method: 'PUT', body: JSON.stringify({ platform: 'kugou', cookie: cookie.trim() }) }); await loadCredStatus() } catch (err) { setCredError(err.message) } finally { setSavingCred(false) }
  }, [cookie, loadCredStatus])

  useEffect(() => { if (viewMode === 'playlists') loadPlaylists() }, [viewMode, loadPlaylists])
  useEffect(() => { if (selectedPlaylist) loadPlaylistSongs(selectedPlaylist) }, [selectedPlaylist, loadPlaylistSongs])
  useEffect(() => { if (viewMode === 'settings') loadCredStatus() }, [viewMode, loadCredStatus])
  useEffect(() => { localStorage.setItem('mb_volume', volume) }, [volume])

  const trackList = (tracks, opts = {}) => {
    if (!tracks || tracks.length === 0) return <p className="mb-empty-text">暂无歌曲</p>
    return tracks.map((t, i) => {
      const isCurrent = currentTrack && buildTrackKey(currentTrack) === buildTrackKey(t)
      return (
        <div key={buildTrackKey(t) || i} className={`mb-track-row ${isCurrent ? 'mb-track-row--active' : ''}`} onDoubleClick={() => playNow(t)}>
          {opts.dragHandle && (<span className="mb-track-grip" draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(i)) }} onDragOver={(e) => { e.preventDefault() }} onDrop={(e) => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(from)) moveSong(from, i) }}><GripIcon /></span>)}
          <span className="mb-track-info" onClick={() => playNow(t)}><span className="mb-track-title">{t.title || t.name || '未知歌曲'}</span><span className="mb-track-sub">{t.artist || t.singer || '未知歌手'}{t.album ? ` · ${t.album}` : ''}</span></span>
          <span className="mb-track-duration">{fmtDuration(t.duration)}</span>
          {t.platform && <span className="mb-track-platform">{t.platform}</span>}
          <span className="mb-track-actions">
            <button className="mb-icon-btn" title="加入队列" onClick={() => addToQueue(t)}><PlusIcon /></button>
            {opts.showAddToPlaylist !== false && (<button className="mb-icon-btn" title="添加到歌单" onClick={() => setAddToPlaylistOpen(t)}><ListMusicIcon /></button>)}
            {opts.onRemove && (<button className="mb-icon-btn mb-icon-btn--danger" title="移除" onClick={() => opts.onRemove(i)}><Trash2Icon /></button>)}
          </span>
        </div>
      )
    })
  }

  return (
    <div className="mb-shell">
      <div className="mb-tabs">
        <button className={`mb-tab ${viewMode === 'search' ? 'mb-tab--active' : ''}`} onClick={() => setViewMode('search')}><SearchIcon /> 搜索</button>
        <button className={`mb-tab ${viewMode === 'playlists' ? 'mb-tab--active' : ''}`} onClick={() => setViewMode('playlists')}><ListMusicIcon /> 歌单</button>
        <button className={`mb-tab ${viewMode === 'settings' ? 'mb-tab--active' : ''}`} onClick={() => setViewMode('settings')}><SettingsIcon /> 凭证</button>
      </div>

      {error && (<div className="mb-error-banner"><p>{error}</p><button className="mb-close-btn" onClick={() => setError('')}><XIcon /></button></div>)}

      {viewMode === 'search' && (
        <div className="mb-search">
          <form className="mb-search-form" onSubmit={doSearch}>
            <div className="mb-search-row">
              <div className="mb-search-input-wrap"><input type="text" className="mb-search-input" placeholder="搜索歌曲、歌手…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
              <select className="mb-platform-select" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="kugou">酷狗</option><option value="all">全部平台</option></select>
              <button type="submit" className="mb-search-btn" disabled={searching || !query.trim()}><SearchIcon /> {searching ? '搜索中…' : '搜索'}</button>
            </div>
          </form>
          {searching && (<div className="mb-loading"><div className="mb-spinner" /><p>搜索中…</p></div>)}
          {searchError && <p className="mb-error-text">{searchError}</p>}
          {!searching && searchResults.length > 0 && (<div className="mb-results"><h3 className="mb-section-title">搜索结果</h3>{trackList(searchResults)}</div>)}
          {!searching && !searchError && searchResults.length === 0 && query && (<p className="mb-empty-text">未找到相关歌曲</p>)}
        </div>
      )}

      {viewMode === 'settings' && (
        <div className="mb-settings">
          <h3 className="mb-section-title">平台凭证</h3>
          <div className="mb-cred-tip">如何获取？前往音乐平台开发者中心创建应用，获取 API Key。</div>
          <div className="mb-cred-status">
            {credLoading ? (<p className="mb-text-muted">检查中…</p>) : credStatus ? (
              <span className={`mb-cred-badge ${credStatus.connected ? 'mb-cred-badge--ok' : 'mb-cred-badge--none'}`}>{credStatus.connected ? '已连接' : '未配置'}</span>
            ) : (<span className="mb-cred-badge mb-cred-badge--none">未配置</span>)}
          </div>
          <form className="mb-cred-form" onSubmit={saveCredentials}>
            <label className="mb-field">
              <span className="mb-field-label">酷狗 Cookie</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type={showCookie ? 'text' : 'password'} className="mb-input" style={{ flex: 1 }} placeholder={hasSavedCookie ? '已保存 (点击编辑)' : '粘贴酷狗 Cookie…'} value={cookie} onChange={(e) => setCookie(e.target.value)} />
                <button type="button" className="mb-icon-btn" onClick={() => setShowCookie(!showCookie)} title={showCookie ? '隐藏' : '显示'}>{showCookie ? '🙈' : '👁️'}</button>
              </div>
              <span className="mb-field-hint">用于获取付费歌曲播放地址</span>
            </label>
            <div className="mb-config-actions">
              <button type="submit" className="mb-save-btn" disabled={savingCred || !cookie.trim()}>{savingCred ? '保存中…' : '保存凭证'}</button>
            </div>
            {credError && <p className="mb-error-text">{credError}</p>}
          </form>
        </div>
      )}

      {currentTrack && (
        <div className="mb-player-bar">
          <div className="mb-player-main">
            <div className="mb-player-info"><span className="mb-player-cover"><MusicIcon /></span><div><div className="mb-player-title">{currentTrack.title || currentTrack.name}</div><div className="mb-player-artist">{currentTrack.artist || currentTrack.singer || '未知'}{currentTrack.platform && <span className="mb-player-platform">{currentTrack.platform}</span>}</div></div></div>
            <div className="mb-player-controls">
              <button className="mb-icon-btn mb-ctrl-btn" onClick={playPrev} title="上一首"><SkipBackIcon /></button>
              <button className="mb-icon-btn mb-ctrl-btn mb-ctrl-btn--play" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>{isPlaying ? <PauseIcon /> : <PlayIcon />}</button>
              <button className="mb-icon-btn mb-ctrl-btn" onClick={playNext} title="下一首"><SkipForwardIcon /></button>
            </div>
            <div className="mb-player-progress-wrap"><span className="mb-player-time">{fmtDuration(currentTime)}</span><div className="mb-player-progress" ref={progressRef} onClick={handleProgressClick}><div className="mb-player-progress-fill" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} /></div><span className="mb-player-time">{fmtDuration(duration)}</span></div>
            <div className="mb-player-extra">
              <div className="mb-volume-wrap"><button className="mb-icon-btn" onClick={() => setVolume(v => v === 0 ? 0.7 : 0)} title="静音切换"><Volume2Icon /></button><input type="range" className="mb-volume-slider" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} /></div>
              <button className={`mb-icon-btn mb-queue-btn ${queueVisible ? 'mb-queue-btn--active' : ''}`} onClick={() => setQueueVisible(v => !v)} title="播放队列"><ListMusicIcon />{queue.length > 0 && <span className="mb-queue-count">{queue.length}</span>}</button>
            </div>
          </div>
        </div>
      )}

      {addToPlaylistOpen && (
        <div className="mb-overlay" onClick={() => setAddToPlaylistOpen(null)}>
          <div className="mb-popup" onClick={(e) => e.stopPropagation()}>
            <div className="mb-popup-header"><h4>添加到歌单</h4><button className="mb-icon-btn" onClick={() => setAddToPlaylistOpen(null)}><XIcon /></button></div>
            <p className="mb-popup-song">{addToPlaylistOpen.title || addToPlaylistOpen.name}</p>
            {playlists.length === 0 ? (<p className="mb-empty-text">暂无歌单</p>) : (<div className="mb-popup-list">{playlists.map((pl) => (<button key={pl.id} className="mb-popup-item" onClick={() => addSongToPlaylist(pl.id, addToPlaylistOpen)}>{pl.name}</button>))}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}
