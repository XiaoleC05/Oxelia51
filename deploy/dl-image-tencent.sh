#!/bin/bash
# 历史一次性脚本：从原 langfuse-token 仓库（已归档，代码并入本仓 web/）的 GitHub Release 下载镜像。
# 现行链路：CI 构建本仓直推 ACR（见 RUNBOOK §3.1）；此脚本仅存档，无对应新地址。
wget --limit-rate=500k -O /tmp/langfuse-token-web.tar.gz \
  https://github.com/XiaoleC05/langfuse-token/releases/download/docker-20260728211940/langfuse-token-web.tar.gz
echo "DOWNLOAD_EXIT_CODE=$?" >> /tmp/lf-dl.log
ls -lh /tmp/langfuse-token-web.tar.gz >> /tmp/lf-dl.log
