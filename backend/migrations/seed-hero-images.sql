-- 头图轮播种子数据：20 张太空/地球/自然/极光/星空图片
-- 图片来源：Unsplash 免费许可（Unsplash License）
-- 在服务器执行：PGPASSWORD=xxx psql -h 127.0.0.1 -U root -d oxelia51 -f seed-hero-images.sql

-- 先清空旧数据（如有）
DELETE FROM hero_images;

-- 重新插入序列
SELECT setval('hero_images_id_seq', 1, false);

INSERT INTO hero_images (image_url, title, subtitle, display_order, enabled) VALUES
-- === 地球与太空 ===
('https://images.unsplash.com/photo-1446776899648-aa78eefe8ed0?w=1920&auto=format&fit=crop&q=80',
 '蓝色弹珠', '从太空俯瞰地球表面，蔚蓝的海洋与白色云层交织，这是我们的家园', 1, TRUE),

('https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&auto=format&fit=crop&q=80',
 '地球与卫星', '人造卫星在地球轨道上静静运行，见证人类探索太空的脚步', 2, TRUE),

('https://images.unsplash.com/photo-1769251971680-005dfa536f07?w=1920&auto=format&fit=crop&q=80',
 '夜空中的地球', '从太空望去，地球的灯火如星河般璀璨，每一盏灯下都是一个故事', 3, TRUE),

('https://images.unsplash.com/photo-1777047023742-1607aeb1a5bb?w=1920&auto=format&fit=crop&q=80',
 '阿尔忒弥斯的凝视', 'NASA 阿尔忒弥斯二世任务拍摄的地球，云层在大气层中流转', 4, TRUE),

-- === 银河与星空 ===
('https://images.unsplash.com/photo-1773760008651-2ba4060dfddf?w=1920&auto=format&fit=crop&q=80',
 '银河之上的暗夜山脉', '银河系横跨天际，暗色山脉的剪影与亿万星辰遥相呼应', 5, TRUE),

('https://images.unsplash.com/photo-1766044531659-a4798add094a?w=1920&auto=format&fit=crop&q=80',
 '湖面倒映银河', '宁静的湖面如同一面镜子，将头顶的银河完整地映照在水中', 6, TRUE),

('https://images.unsplash.com/photo-1772511988877-f29dc05295cf?w=1920&auto=format&fit=crop&q=80',
 '广袤星空', '无边的星空在大地剪影之上延展，让人感受到宇宙的浩瀚', 7, TRUE),

('https://images.unsplash.com/photo-1765912679255-57c3dd2f2ad7?w=1920&auto=format&fit=crop&q=80',
 '流星与松林', '银河中划过流星的瞬间，松林的剪影为这片星空增添了生命气息', 8, TRUE),

-- === 极光 ===
('https://images.unsplash.com/photo-1768943555018-331034a7a654?w=1920&auto=format&fit=crop&q=80',
 '格陵兰极光', '绿色极光在格陵兰冰冷的海面上方舞动，这是太阳风与地球磁场的交响', 9, TRUE),

('https://images.unsplash.com/photo-1767076375923-afcbc92bc5a3?w=1920&auto=format&fit=crop&q=80',
 '北极之光', '挪威雪山顶上，北极光如绿色的丝绸般铺展，小村庄在光幕下静静安睡', 10, TRUE),

('https://images.unsplash.com/photo-1768972733362-6bd0f8723929?w=1920&auto=format&fit=crop&q=80',
 '海滩极光', '澳大利亚的海岸线上空，极光以不寻常的纬度出现，海浪与星光共鸣', 11, TRUE),

('https://images.unsplash.com/photo-1769197446934-f3e08f877288?w=1920&auto=format&fit=crop&q=80',
 '色彩之舞', '极光以紫色和绿色的色彩在大地上空舞动，是大自然最壮观的灯光秀', 12, TRUE),

-- === 国际空间站与火箭 ===
('https://images.unsplash.com/photo-1614314007212-0257d6e2f7d8?w=1920&auto=format&fit=crop&q=80',
 '国际空间站', 'ISS 在地球上方轨道运行，人类在太空中持续驻留已经超过二十年', 13, TRUE),

('https://images.unsplash.com/photo-1762135245629-1e79d4cc30b3?w=1920&auto=format&fit=crop&q=80',
 '火箭破空', '火箭在彩色天空的映衬下腾空而起，承载着人类对未知的好奇与渴望', 14, TRUE),

('https://images.unsplash.com/photo-1517976384346-3136801d605d?w=1920&auto=format&fit=crop&q=80',
 '猎鹰重型', 'SpaceX 猎鹰重型火箭在金色时刻的光线中矗立，即将开启新的旅程', 15, TRUE),

-- === 沙漠与星空 ===
('https://images.unsplash.com/photo-1763793931147-ef1a57367c4a?w=1920&auto=format&fit=crop&q=80',
 '沙漠星河', '广袤的沙漠在银河之下延展，岩石与星辰在亿万年间共同守望着这片大地', 16, TRUE),

('https://images.unsplash.com/photo-1733855803980-eeed78f64836?w=1920&auto=format&fit=crop&q=80',
 '阿塔卡马星空', '智利阿塔卡马沙漠——地球上最干燥的地方，也是离星空最近的地方', 17, TRUE),

-- === 山脉与星空 ===
('https://images.unsplash.com/photo-1726461974101-d98a3c616dcc?w=1920&auto=format&fit=crop&q=80',
 '山脉星海', '夜空中繁星密布，远处的山脉在星光下若隐若现，构成一幅天然的画卷', 18, TRUE),

('https://images.unsplash.com/photo-1643396920946-f5fa002a840a?w=1920&auto=format&fit=crop&q=80',
 '沙漠之夜', '沙漠的夜空中星辰铺满天幕，大地在星光中展现出另一种生命', 19, TRUE),

-- === 日落与海洋 ===
('https://images.unsplash.com/photo-1780484201682-66f0db5045e9?w=1920&auto=format&fit=crop&q=80',
 '金色海平线', '夕阳沉入海平面的瞬间，金色的光芒洒满洋面，远山在暮色中化为剪影', 20, TRUE);
