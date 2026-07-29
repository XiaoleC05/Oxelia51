#!/bin/bash
# Download langfuse-token Docker image on Tencent Cloud
wget --limit-rate=500k -O /tmp/langfuse-token-web.tar.gz \
  https://github.com/XiaoleC05/langfuse-token/releases/download/docker-20260728211940/langfuse-token-web.tar.gz
echo "DOWNLOAD_EXIT_CODE=$?" >> /tmp/lf-dl.log
ls -lh /tmp/langfuse-token-web.tar.gz >> /tmp/lf-dl.log
