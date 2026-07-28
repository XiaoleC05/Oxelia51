cmake_minimum_required(VERSION 3.16)
project(token-analytics VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# 依赖：libcurl（ClickHouse HTTP + Webhook + SMTP）、libpq（PostgreSQL）
# 不使用 clickhouse-cpp 原生协议，改用 HTTP 接口（端口 8123）
find_package(PkgConfig REQUIRED)
pkg_check_modules(LIBPQ REQUIRED libpq)
pkg_check_modules(CURL REQUIRED libcurl)

add_executable(token-analytics
    src/main.cpp
    src/aggregator.cpp
    src/pricing.cpp
    src/detector.cpp
    src/alerter.cpp
    src/db/clickhouse.cpp
    src/db/postgres.cpp
)

target_include_directories(token-analytics PRIVATE
    ${LIBPQ_INCLUDE_DIRS}
    ${CURL_INCLUDE_DIRS}
    src
)

target_link_libraries(token-analytics
    ${LIBPQ_LIBRARIES}
    ${CURL_LIBRARIES}
)

target_compile_options(token-analytics PRIVATE -Wall -Wextra)
