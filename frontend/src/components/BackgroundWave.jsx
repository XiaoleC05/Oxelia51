import './BackgroundWave.css'

function BackgroundWave() {
  return (
    <div className="background-wave" aria-hidden="true">
      <div className="background-wave__bands" />
      <div className="background-wave__glow" />
    </div>
  )
}

export default BackgroundWave
