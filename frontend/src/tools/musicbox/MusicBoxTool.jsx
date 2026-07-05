import ToolPlaceholder from '../shared/ToolPlaceholder'

export default function MusicBoxTool() {
  return (
    <ToolPlaceholder
      icon="🎵"
      title="MusicBox"
      summary="跨平台音乐聚合播放，统一搜索并自动切换最优音源。"
      features={[
        '多平台聚合搜索与播放控制',
        '无版权时自动切换备用平台',
        '一份歌单可混合不同平台歌曲',
      ]}
      releaseUrl="https://github.com/XiaoleC05/MusicBox/releases"
      repoUrl="https://github.com/XiaoleC05/MusicBox"
    />
  )
}
