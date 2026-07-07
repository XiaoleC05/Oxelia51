import { useMemo } from 'react'
import './BackgroundWave.css'

function BackgroundWave() {
  const stars = useMemo(() => {
    const arr = []
    let s = 7919
    const rand = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    for (let i = 0; i < 220; i++) {
      arr.push({
        id: i,
        x: rand() * 100,
        y: rand() * 100,
        size: 0.8 + rand() * 2.2,
        opacity: 0.25 + rand() * 0.65,
        twinkleDuration: 3 + rand() * 5,
        twinkleDelay: rand() * 6,
      })
    }
    return arr
  }, [])

  return (
    <div className="background-wave" aria-hidden="true">
      <div className="background-wave__field">
        {stars.map(s => (
          <div
            key={s.id}
            className="background-wave__star"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
              animationDuration: `${s.twinkleDuration}s`,
              animationDelay: `${s.twinkleDelay}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default BackgroundWave
