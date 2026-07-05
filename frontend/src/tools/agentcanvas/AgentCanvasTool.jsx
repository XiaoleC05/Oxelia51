import ToolPlaceholder from '../shared/ToolPlaceholder'

export default function AgentCanvasTool() {
  return (
    <ToolPlaceholder
      icon="🧠"
      title="AgentCanvas"
      summary="可视化 AI Agent 的任务分解、推理链路与工具调用过程。"
      features={[
        '交互式树形图展示 Agent 执行链路',
        '逐步播放，查看每步推理与工具调用',
        '树形图、时间线、流程图多种视图',
      ]}
      releaseUrl="https://github.com/XiaoleC05/AgentCanvas/releases"
      repoUrl="https://github.com/XiaoleC05/AgentCanvas"
    />
  )
}
