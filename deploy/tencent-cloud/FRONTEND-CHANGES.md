# F3 前端变更：管理面板腾讯云监控卡片

> 所属智能体：**Hermes**（前端/CSS/布局）
> 后端 API 已完成：`GET /api/admin/server-stats` 响应新增 `remote` 字段

## API 响应格式

```json
{
  "cpu_percent": 12.5,     // ← 阿里云（保持不变，向后兼容）
  "memory_used_mb": 512,
  "memory_total_mb": 1980,
  "disk_used_percent": 45.3,
  "disk_total_gb": 40,
  "uptime_seconds": 864000,
  "go_goroutines": 34,
  "go_alloc_mb": 28,
  "remote": {               // ← 新增：腾讯云（若配置了 TENCENT_HEALTH_URL）
    "cpu_percent": 8.2,
    "memory_used_mb": 1024,
    "memory_total_mb": 3950,
    "disk_used_percent": 32.1,
    "disk_total_gb": 80,
    "uptime_seconds": 172800,
    "go_goroutines": 12,
    "go_alloc_mb": 8
  }
}
```

- `remote` 为 `null` 或不存在时：不显示腾讯云卡片（服务器未配置或不可达）
- `remote` 存在时：显示第二张服务器卡片

## 前端实现

在 `Admin.jsx` 的 `ServerStatsSection` 组件中，现有服务器监控卡片后面追加：

```jsx
{stats.remote && (
  <>
    <div className="server-stats-header" style={{ marginTop: '2rem' }}>
      <h2>腾讯云服务器监控</h2>
      <span className={`server-status-dot ${stats.remote.cpu_percent < 90 ? 'online' : 'warning'}`} />
      <span className="server-status-text">
        {stats.remote.cpu_percent < 90 ? '运行正常' : '负载偏高'}
      </span>
    </div>
    <div className="server-stats-grid">
      <div className="server-card">
        <h4 className="server-card-title">CPU 使用率</h4>
        <p className="server-card-value">{stats.remote.cpu_percent.toFixed(1)}%</p>
        <ProgressBar percent={stats.remote.cpu_percent} />
      </div>
      <div className="server-card">
        <h4 className="server-card-title">内存</h4>
        <p className="server-card-value">
          {stats.remote.memory_used_mb} / {stats.remote.memory_total_mb} MB
        </p>
        <ProgressBar
          percent={
            stats.remote.memory_total_mb > 0
              ? (stats.remote.memory_used_mb / stats.remote.memory_total_mb) * 100
              : 0
          }
        />
      </div>
      <div className="server-card">
        <h4 className="server-card-title">磁盘</h4>
        <p className="server-card-value">{stats.remote.disk_used_percent.toFixed(1)}%</p>
        <ProgressBar percent={stats.remote.disk_used_percent} />
      </div>
      <div className="server-card">
        <h4 className="server-card-title">运行时间</h4>
        <p className="server-card-value">
          {Math.floor(stats.remote.uptime_seconds / 86400)} 天{' '}
          {Math.floor((stats.remote.uptime_seconds % 86400) / 3600)} 小时
        </p>
      </div>
      <div className="server-card">
        <h4 className="server-card-title">Goroutines</h4>
        <p className="server-card-value">{stats.remote.go_goroutines}</p>
      </div>
      <div className="server-card">
        <h4 className="server-card-title">Go 内存</h4>
        <p className="server-card-value">{stats.remote.go_alloc_mb} MB</p>
      </div>
    </div>
  </>
)}
```

## 环境变量

阿里云 `/opt/Oxelia51/backend/.env` 需配置：

```
TENCENT_HEALTH_URL=http://118.25.138.177/api/health
```
