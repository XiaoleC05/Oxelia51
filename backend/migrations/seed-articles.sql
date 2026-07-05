-- 文章种子数据（来源：xiaolec05.github.io）
-- 在服务器执行：PGPASSWORD=xxx psql -h 127.0.0.1 -U root -d oxelia51 -f seed-articles.sql

DELETE FROM articles;
SELECT setval('articles_id_seq', 1, false);

INSERT INTO articles (title, url, summary, category, published_at, display_order, enabled) VALUES
('软考程序设计师 — 知识点整理',
 'https://xiaolec05.github.io/2026/06/02/ruankao-program-designer-knowledge/',
 '整理自个人软考复习笔记，覆盖程序设计师考试主要知识模块，便于检索与复习。包括面向对象技术、UML 图、设计模式等内容。',
 '学习笔记', '2026-06-02', 1, TRUE),

('C++ 数据结构与算法学习笔记',
 'https://xiaolec05.github.io/2026/06/02/project-dsa-study/',
 '根据 GitHub 仓库 XiaoleC05/DataStructures-Algorithms-Study 整理的 C++ 数据结构与算法学习笔记。',
 '项目', '2026-06-02', 2, TRUE),

('算法进阶石（Algorithm Stone）刷题路线图',
 'https://xiaolec05.github.io/2026/06/02/project-algorithm-stone/',
 'ACM/LeetCode 刷题路线图，fork 自 acm-clan/algorithm-stone，涵盖动态规划、图论、字符串等核心算法专题。',
 '项目', '2026-06-02', 3, TRUE),

('宿舍电费守护（DormPowerGuard-Lite）',
 'https://xiaolec05.github.io/2026/06/02/project-dorm-power-guard-lite/',
 '宿舍电费监控与告警系统，自动抓取电费余额并通过 QQ 机器人推送告警，已集成至 Oxelia51 平台。',
 '项目', '2026-06-02', 4, TRUE),

('快账（QuickAccount）本地记账应用',
 'https://xiaolec05.github.io/2026/06/02/project-quickaccount/',
 '基于 Qt 6 / C++ / SQLite 的本地记账应用，支持分类统计、月度报表、数据导入导出。',
 '项目', '2026-06-02', 5, TRUE),

('给读者：关于这个小站的几句话',
 'https://xiaolec05.github.io/2026/04/12/chenxiaole/',
 '你好，我是陈晓乐。这里是我自己的网站，主要放学习笔记、偶尔的生活随笔，以及少量项目链接。',
 '随笔', '2026-04-12', 6, TRUE);
