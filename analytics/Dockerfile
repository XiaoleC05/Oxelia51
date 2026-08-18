# =============================================
# token-analytics Linux 构建镜像（本地编译产物，禁止服务器上 make/cmake）
# 用法：在仓库根目录
#   docker build -f analytics/Dockerfile -t oxelia51/analytics-builder analytics
#   docker run --rm -v <outdir>:/out oxelia51/analytics-builder cp /build/token-analytics /out/
# 国内网络：ubuntu:24.04 拉取受限时，可用本地已有的 debian:bookworm-slim
# 替代 FROM 起容器，apt 换 mirrors.aliyun.com 后安装依赖
# =============================================
FROM ubuntu:24.04

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      cmake g++ make pkg-config libcurl4-openssl-dev libpq-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . /src

RUN cmake -S /src -B /build -DCMAKE_BUILD_TYPE=Release \
 && cmake --build /build -j"$(nproc)"

CMD ["/build/token-analytics", "--help"]
