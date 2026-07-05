import ToolPlaceholder from '../shared/ToolPlaceholder'

export default function AIHelperTool() {
  return (
    <ToolPlaceholder
      icon="✨"
      title="AIHelper"
      summary="将模糊需求转化为结构化提示词，并建立可检索的提示词记忆库。"
      features={[
        '分析缺失要素并自动补全提示词',
        '编程、写作、翻译等分类模板',
        '标签归类与全文检索历史提示词',
      ]}
      releaseUrl="https://github.com/XiaoleC05/AIHelper/releases"
      repoUrl="https://github.com/XiaoleC05/AIHelper"
    />
  )
}
