import ToolPlaceholder from '../shared/ToolPlaceholder'

export default function SuperReadTool() {
  return (
    <ToolPlaceholder
      icon="📰"
      title="SuperRead"
      summary="RSS 订阅与 AI 简报，五分钟浏览当日全部更新摘要。"
      features={[
        '添加 RSS 源，支持 OPML 批量导入',
        '定时抓取新文章，大模型生成单句摘要',
        '每日简报汇总，多来源报道自动去重',
      ]}
      releaseUrl="https://github.com/XiaoleC05/SuperRead/releases"
      repoUrl="https://github.com/XiaoleC05/SuperRead"
    />
  )
}
