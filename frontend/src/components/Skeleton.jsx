import './Skeleton.css'

export function SkeletonLine({ width = '100%', height = '14px' }) {
  return <div className="sk-line" style={{ width, height }} />
}

export function SkeletonCard() {
  return (
    <div className="sk-card">
      <div className="sk-line" style={{ width: '60%', height: '20px' }} />
      <div className="sk-line" style={{ width: '100%', height: '14px' }} />
      <div className="sk-line" style={{ width: '40%', height: '14px' }} />
    </div>
  )
}

export function SkeletonBlock({ lines = 3 }) {
  return (
    <div className="sk-block">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="sk-line"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="page-skeleton">
      <div className="sk-line" style={{ width: '40%', height: '28px' }} />
      <div className="sk-line" style={{ width: '100%', height: '14px' }} />
      <div className="sk-line" style={{ width: '80%', height: '14px' }} />
      <div className="sk-line" style={{ width: '60%', height: '14px' }} />
    </div>
  )
}

export default PageSkeleton
