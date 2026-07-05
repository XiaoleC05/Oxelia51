import ToolPlaceholder from '../shared/ToolPlaceholder'

export default function CS2LabTool() {
  return (
    <ToolPlaceholder
      icon="🎯"
      title="CS2Lab"
      summary="CS2 全竞技地图道具教学，覆盖投掷点位、准星参照与配合说明。"
      features={[
        '竞技地图烟雾、闪光、燃烧、手雷点位图鉴',
        '站位、准星截图与投掷方式标注',
        '场景搜索、收藏与个人笔记',
      ]}
      releaseUrl="https://github.com/XiaoleC05/CS2Lab/releases"
      repoUrl="https://github.com/XiaoleC05/CS2Lab"
    />
  )
}
