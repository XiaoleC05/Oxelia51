import { useEffect, useState, useCallback } from 'react'
import { apiProxy } from '../../api'
import './CS2LabTool.css'

/* ===== Inline SVG Icons (Lucide style, 16×16) ===== */
function MapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  )
}
function StarIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
function FileTextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  )
}
function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

/* ===== Type badge ===== */
const TYPE_ICONS = {
  smoke: '💨',
  flash: '⚡',
  molotov: '🔥',
  grenade: '💣',
}

const TYPE_LABELS = {
  smoke: '烟雾',
  flash: '闪光',
  molotov: '燃烧',
  grenade: '手雷',
}

export default function CS2LabTool() {
  // --- View ---
  const [viewMode, setViewMode] = useState('maps') // maps | browser | favorites
  const [error, setError] = useState('')

  // --- Maps ---
  const [maps, setMaps] = useState([])
  const [mapsLoading, setMapsLoading] = useState(true)

  // --- Browser ---
  const [selectedMapId, setSelectedMapId] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [lineups, setLineups] = useState([])
  const [lineupsLoading, setLineupsLoading] = useState(false)
  const [favoritedIds, setFavoritedIds] = useState(new Set())

  // --- Detail ---
  const [selectedLineup, setSelectedLineup] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [noteContent, setNoteContent] = useState('')
  const [noteLoaded, setNoteLoaded] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)

  // --- Favorites ---
  const [favoriteLineups, setFavoriteLineups] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)

  /* ===== Maps ===== */
  const loadMaps = useCallback(async () => {
    setMapsLoading(true)
    try {
      const data = await apiProxy('cs2lab', 'api/maps')
      setMaps(Array.isArray(data) ? data : (data?.maps || []))
    } catch (err) { setError(err.message) }
    finally { setMapsLoading(false) }
  }, [])

  /* ===== Lineups ===== */
  const loadLineups = useCallback(async (mapId, type, q) => {
    setLineupsLoading(true)
    try {
      const params = new URLSearchParams()
      if (mapId) params.set('map_id', mapId)
      if (type) params.set('type', type)
      if (q) params.set('q', q)
      const qs = params.toString()
      const path = qs ? `api/lineups?${qs}` : 'api/lineups'
      const data = await apiProxy('cs2lab', path)
      setLineups(Array.isArray(data) ? data : (data?.lineups || []))
    } catch (err) { setError(err.message) }
    finally { setLineupsLoading(false) }
  }, [])

  /* ===== Favorites ===== */
  const loadFavorites = useCallback(async () => {
    setFavoritesLoading(true)
    try {
      const data = await apiProxy('cs2lab', 'api/favorites')
      const items = Array.isArray(data) ? data : (data?.favorites || [])
      setFavoriteLineups(items)
      setFavoritedIds(new Set(items.map((f) => f.lineup_id || f.id)))
    } catch (err) { setError(err.message) }
    finally { setFavoritesLoading(false) }
  }, [])

  const toggleFavorite = useCallback(async (lineupId) => {
    const isFav = favoritedIds.has(lineupId)
    try {
      if (isFav) {
        await apiProxy('cs2lab', `api/favorites/${lineupId}`, { method: 'DELETE' })
      } else {
        await apiProxy('cs2lab', 'api/favorites', {
          method: 'POST',
          body: JSON.stringify({ lineup_id: lineupId }),
        })
      }
      setFavoritedIds((prev) => {
        const next = new Set(prev)
        if (isFav) next.delete(lineupId)
        else next.add(lineupId)
        return next
      })
    } catch (err) { setError(err.message) }
  }, [favoritedIds])

  /* ===== Detail ===== */
  const openDetail = useCallback(async (lineup) => {
    setSelectedLineup(lineup)
    setCarouselIdx(0)
    setNoteContent('')
    setNoteLoaded(false)
    setDetailLoading(true)
    try {
      const [detail, note] = await Promise.all([
        apiProxy('cs2lab', `api/lineups/${lineup.id}`),
        apiProxy('cs2lab', `api/notes/${lineup.id}`).catch(() => null),
      ])
      setSelectedLineup(detail || lineup)
      if (note && (note.content || note.content === '')) {
        setNoteContent(note.content)
      }
      setNoteLoaded(true)
    } catch (err) { setError(err.message) }
    finally { setDetailLoading(false) }
  }, [])

  const saveNote = useCallback(async () => {
    if (!selectedLineup) return
    setNoteSaving(true)
    try {
      await apiProxy('cs2lab', `api/notes/${selectedLineup.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: noteContent }),
      })
    } catch (err) { setError(err.message) }
    finally { setNoteSaving(false) }
  }, [selectedLineup, noteContent])

  /* ===== Init ===== */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadMaps() }, [loadMaps])

  useEffect(() => {
    if (viewMode === 'browser') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadLineups(selectedMapId, filterType, searchQuery)
    }
  }, [viewMode, selectedMapId, filterType, searchQuery, loadLineups])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (viewMode === 'favorites') loadFavorites()
  }, [viewMode, loadFavorites])

  const browseMap = useCallback((mapId) => {
    setSelectedMapId(mapId)
    setFilterType('')
    setSearchQuery('')
    setViewMode('browser')
  }, [])

  const browseAll = useCallback(() => {
    setSelectedMapId(null)
    setFilterType('')
    setSearchQuery('')
    setViewMode('browser')
  }, [])

  const selectedMap = maps.find((m) => m.id === selectedMapId)

  // --- list of image URLs from detail ---
  const images = selectedLineup?.image_urls
    ? (Array.isArray(selectedLineup.image_urls) ? selectedLineup.image_urls : [selectedLineup.image_urls])
    : (selectedLineup?.image_url ? [selectedLineup.image_url] : [])

  /* ===== Render ===== */
  return (
    <div className="cl-shell">

      {/* ---- Error Banner ---- */}
      {error && (
        <div className="cl-error-banner">
          <p>{error}</p>
          <button className="cl-close-btn" onClick={() => setError('')}><XIcon /></button>
        </div>
      )}

      {/* ---- Tabs ---- */}
      <div className="cl-tabs">
        <button
          className={`cl-tab ${viewMode === 'maps' ? 'cl-tab--active' : ''}`}
          onClick={() => setViewMode('maps')}
        >
          <MapIcon /> 地图
        </button>
        <button
          className={`cl-tab ${viewMode === 'browser' ? 'cl-tab--active' : ''}`}
          onClick={browseAll}
        >
          <SearchIcon /> 道具
        </button>
        <button
          className={`cl-tab ${viewMode === 'favorites' ? 'cl-tab--active' : ''}`}
          onClick={() => setViewMode('favorites')}
        >
          <StarIcon /> 收藏
        </button>
      </div>

      {/* ===== Maps View ===== */}
      {viewMode === 'maps' && (
        <div className="cl-maps">
          {mapsLoading ? (
            <div className="cl-loading"><div className="cl-spinner" /><p>加载地图…</p></div>
          ) : maps.length === 0 ? (
            <p className="cl-empty-text">暂无地图数据</p>
          ) : (
            <div className="cl-maps-grid">
              {maps.map((m) => (
                <div key={m.id} className="cl-map-card" onClick={() => browseMap(m.id)}>
                  <div className="cl-map-card-icon"><MapIcon /></div>
                  <h3 className="cl-map-card-name">{m.name || m.map_name}</h3>
                  {m.lineup_count != null && (
                    <span className="cl-map-card-count">{m.lineup_count} 个道具</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Browser View ===== */}
      {viewMode === 'browser' && (
        <div className="cl-browser">
          {/* Filters */}
          <div className="cl-filters">
            <div className="cl-filter-row">
              <select
                className="cl-select"
                value={selectedMapId || ''}
                onChange={(e) => setSelectedMapId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">全部地图</option>
                {maps.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.map_name}</option>
                ))}
              </select>

              <select
                className="cl-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">全部类型</option>
                <option value="smoke">💨 烟雾</option>
                <option value="flash">⚡ 闪光</option>
                <option value="molotov">🔥 燃烧</option>
                <option value="grenade">💣 手雷</option>
              </select>

              <div className="cl-search-wrap">
                <SearchIcon />
                <input
                  type="text"
                  className="cl-search-input"
                  placeholder="搜索道具…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {selectedMap && (
              <div className="cl-current-map">
                <MapIcon /> {selectedMap.name || selectedMap.map_name}
              </div>
            )}
          </div>

          {/* Lineup grid */}
          {lineupsLoading ? (
            <div className="cl-loading"><div className="cl-spinner" /><p>加载道具…</p></div>
          ) : lineups.length === 0 ? (
            <p className="cl-empty-text">暂无道具数据</p>
          ) : (
            <div className="cl-lineups-grid">
              {lineups.map((l) => (
                <div key={l.id} className="cl-lineup-card" onClick={() => openDetail(l)}>
                  <div className="cl-lineup-card-header">
                    <span className="cl-lineup-type">{TYPE_ICONS[l.type] || l.type} {TYPE_LABELS[l.type] || l.type}</span>
                    <button
                      className={`cl-fav-btn ${favoritedIds.has(l.id) ? 'cl-fav-btn--active' : ''}`}
                      title={favoritedIds.has(l.id) ? '取消收藏' : '收藏'}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(l.id) }}
                    >
                      <StarIcon filled={favoritedIds.has(l.id)} />
                    </button>
                  </div>
                  <h4 className="cl-lineup-title">{l.title || l.name}</h4>
                  {l.throw_type && <span className="cl-lineup-throw">{l.throw_type}</span>}
                  {l.description && <p className="cl-lineup-desc">{l.description}</p>}
                  {l.image_url && (
                    <div className="cl-lineup-thumb">
                      <img src={l.image_url} alt={l.title || l.name} loading="lazy" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Favorites View ===== */}
      {viewMode === 'favorites' && (
        <div className="cl-favorites">
          {favoritesLoading ? (
            <div className="cl-loading"><div className="cl-spinner" /><p>加载收藏…</p></div>
          ) : favoriteLineups.length === 0 ? (
            <p className="cl-empty-text">暂无收藏，去道具页面添加吧</p>
          ) : (
            <div className="cl-lineups-grid">
              {favoriteLineups.map((l) => (
                <div key={l.id || l.lineup_id} className="cl-lineup-card" onClick={() => openDetail(l)}>
                  <div className="cl-lineup-card-header">
                    <span className="cl-lineup-type">{TYPE_ICONS[l.type] || l.type} {TYPE_LABELS[l.type] || l.type}</span>
                    <button
                      className="cl-fav-btn cl-fav-btn--active"
                      title="取消收藏"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(l.lineup_id || l.id) }}
                    >
                      <StarIcon filled />
                    </button>
                  </div>
                  <h4 className="cl-lineup-title">{l.title || l.name}</h4>
                  {l.throw_type && <span className="cl-lineup-throw">{l.throw_type}</span>}
                  {l.description && <p className="cl-lineup-desc">{l.description}</p>}
                  {l.image_url && (
                    <div className="cl-lineup-thumb">
                      <img src={l.image_url} alt={l.title || l.name} loading="lazy" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Detail Modal ===== */}
      {selectedLineup && (
        <div className="cl-overlay" onClick={() => setSelectedLineup(null)}>
          <div className="cl-detail" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="cl-detail-header">
              <button className="cl-back-btn" onClick={() => setSelectedLineup(null)}>
                <ChevronLeftIcon /> 返回
              </button>
              <button
                className={`cl-fav-btn cl-fav-btn--lg ${favoritedIds.has(selectedLineup.id) ? 'cl-fav-btn--active' : ''}`}
                onClick={() => toggleFavorite(selectedLineup.id)}
                title={favoritedIds.has(selectedLineup.id) ? '取消收藏' : '收藏'}
              >
                <StarIcon filled={favoritedIds.has(selectedLineup.id)} />
              </button>
            </div>

            {detailLoading ? (
              <div className="cl-loading"><div className="cl-spinner" /><p>加载详情…</p></div>
            ) : (
              <>
                {/* Carousel */}
                {images.length > 0 && (
                  <div className="cl-carousel">
                    <div className="cl-carousel-view">
                      <img
                        key={carouselIdx}
                        src={images[carouselIdx]}
                        alt={`${selectedLineup.title || selectedLineup.name} - ${carouselIdx + 1}`}
                      />
                    </div>
                    {images.length > 1 && (
                      <div className="cl-carousel-nav">
                        <button
                          className="cl-carousel-btn"
                          onClick={() => setCarouselIdx((i) => (i - 1 + images.length) % images.length)}
                        >
                          <ChevronLeftIcon />
                        </button>
                        <span className="cl-carousel-idx">{carouselIdx + 1} / {images.length}</span>
                        <button
                          className="cl-carousel-btn"
                          onClick={() => setCarouselIdx((i) => (i + 1) % images.length)}
                        >
                          <ChevronRightIcon />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="cl-detail-body">
                  <div className="cl-detail-meta">
                    <span className="cl-lineup-type">
                      {TYPE_ICONS[selectedLineup.type] || selectedLineup.type} {TYPE_LABELS[selectedLineup.type] || selectedLineup.type}
                    </span>
                    {selectedLineup.map_name && (
                      <span className="cl-detail-map"><MapIcon /> {selectedLineup.map_name}</span>
                    )}
                  </div>

                  <h3 className="cl-detail-title">{selectedLineup.title || selectedLineup.name}</h3>

                  {selectedLineup.throw_type && (
                    <div className="cl-detail-throw">
                      <strong>投掷方式：</strong>{selectedLineup.throw_type}
                    </div>
                  )}

                  {selectedLineup.description && (
                    <p className="cl-detail-desc">{selectedLineup.description}</p>
                  )}

                  {/* Notes */}
                  <div className="cl-notes">
                    <div className="cl-notes-header">
                      <FileTextIcon />
                      <span>笔记</span>
                    </div>
                    <textarea
                      className="cl-notes-textarea"
                      placeholder="记录投掷要点、准星参照…"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      rows={4}
                    />
                    <button
                      className="cl-save-btn"
                      onClick={saveNote}
                      disabled={noteSaving || !noteLoaded}
                    >
                      {noteSaving ? '保存中…' : '保存笔记'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
