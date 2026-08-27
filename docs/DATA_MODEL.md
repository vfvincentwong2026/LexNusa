# LexNusa 数据模型（D1 数据库 Schema）

> **文档版本**：v1.0.0 | **最后更新**：2026-08-27

---

## 1. 概述

LexNusa 使用 Cloudflare D1（分布式 SQLite）存储核心图谱数据。所有法规、条款、实体及其关系以“节点-边”模型存储，通过递归 CTE 实现图谱遍历。

---

## 2. 核心表结构

### 2.1 `nodes` — 节点表

存储所有法规、条款、实体节点。

```sql
CREATE TABLE IF NOT EXISTS nodes (
  id            TEXT PRIMARY KEY,          -- 节点唯一标识（如 "UU_2023_6"）
  name          TEXT NOT NULL,             -- 法规/条款名称
  type          TEXT NOT NULL,             -- 节点类型（见下方枚举）
  content       TEXT,                      -- 全文内容（条款正文）
  description   TEXT,                      -- 摘要描述
  metadata      JSON,                      -- 扩展元数据（JSON 格式）
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nodes_type (type),
  INDEX idx_nodes_name (name)
);
节点类型枚举（type）：

类型	说明	示例
UU	法律（Undang-Undang）	UU No. 40 Tahun 2007
PP	政府条例（Peraturan Pemerintah）	PP No. 9 Tahun 2021
PERMEN	部长条例（Peraturan Menteri）	PERMEN ESDM No. 12/2023
PERDA	地方法规（Peraturan Daerah）	PERDA DKI No. 1/2022
ARTICLE	条款（具体条文）	Pasal 1 Ayat 1
ENTITY	实体（机构/概念）	BKPM, NPWP
2.2 edges — 关系边表
存储节点之间的关系。

sql
CREATE TABLE IF NOT EXISTS edges (
  id            TEXT PRIMARY KEY,          -- 关系唯一标识
  source_id     TEXT NOT NULL,             -- 起始节点 ID
  target_id     TEXT NOT NULL,             -- 终止节点 ID
  relation_type TEXT NOT NULL,             -- 关系类型（见下方枚举）
  metadata      JSON,                      -- 关系元数据（如 "生效日期"）
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_edges_source (source_id),
  INDEX idx_edges_target (target_id),
  INDEX idx_edges_relation (relation_type),
  FOREIGN KEY (source_id) REFERENCES nodes(id),
  FOREIGN KEY (target_id) REFERENCES nodes(id)
);
关系类型枚举（relation_type）：

类型	说明	示例
AMENDS	修订	UU_2023_6 AMENDS UU_2007_40
REPEALS	废止	UU_2023_6 REPEALS UU_2003_13
REFERENCES	引用	PP_2021_9 REFERENCES UU_2007_40
DERIVES_FROM	下位法源自	PP_2021_9 DERIVES_FROM UU_2007_40
REPLACES	替代	UU_2023_6 REPLACES UU_2010_8
RELATED_TO	关联（通用）	法规与实体之间的关联
2.3 vector_meta — 向量元数据表
存储向量索引与节点的映射关系（实际向量存储在 Cloudflare Vectorize 中）。

sql
CREATE TABLE IF NOT EXISTS vector_meta (
  id                TEXT PRIMARY KEY,
  node_id           TEXT NOT NULL,         -- 对应 nodes.id
  chunk_text        TEXT NOT NULL,         -- 生成向量的原始文本片段
  vectorize_index   TEXT NOT NULL,         -- Vectorize 索引名称
  embedding_model   TEXT DEFAULT 'bge-base-en-v1.5',
  char_start        INTEGER,               -- 在原文中的起始位置
  char_end          INTEGER,               -- 在原文中的结束位置
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);
3. 关键查询示例
3.1 查找某法规的所有上位法（递归 CTE）
sql
WITH RECURSIVE parent_tree AS (
  -- 起点：目标法规
  SELECT id, name, 0 AS depth, id AS root_id
  FROM nodes
  WHERE id = 'UU_2023_6'

  UNION ALL

  -- 递归：向上追溯
  SELECT n.id, n.name, pt.depth + 1, pt.root_id
  FROM nodes n
  JOIN edges e ON n.id = e.source_id
  JOIN parent_tree pt ON e.target_id = pt.id
  WHERE e.relation_type IN ('AMENDS', 'REPLACES', 'DERIVES_FROM')
    AND pt.depth < 10   -- 防止无限循环
)
SELECT * FROM parent_tree ORDER BY depth;
3.2 查找某法规的所有下位法（向下遍历）
sql
WITH RECURSIVE child_tree AS (
  SELECT id, name, 0 AS depth
  FROM nodes
  WHERE id = 'UU_2007_40'

  UNION ALL

  SELECT n.id, n.name, ct.depth + 1
  FROM nodes n
  JOIN edges e ON n.id = e.target_id
  JOIN child_tree ct ON e.source_id = ct.id
  WHERE e.relation_type IN ('DERIVES_FROM', 'REFERENCES')
    AND ct.depth < 10
)
SELECT * FROM child_tree ORDER BY depth;
3.3 查找两个法规之间的路径（最短路径）
sql
WITH RECURSIVE path_finder AS (
  SELECT source_id, target_id, 1 AS depth,
         json_array(source_id, target_id) AS path
  FROM edges
  WHERE source_id = 'UU_2023_6'

  UNION ALL

  SELECT e.source_id, e.target_id, pf.depth + 1,
         json_insert(pf.path, '$[#]', e.target_id)
  FROM edges e
  JOIN path_finder pf ON e.source_id = pf.target_id
  WHERE pf.depth < 10
    AND json_each(pf.path) != e.target_id  -- 防环
)
SELECT * FROM path_finder WHERE target_id = 'PP_2021_9';
3.4 混合检索（关键词 + 向量）
sql
-- 1. 关键词匹配（D1）
SELECT id, name, content, 'keyword' AS match_type
FROM nodes
WHERE name LIKE '%PMA%' OR content LIKE '%modal asing%'
LIMIT 20;

-- 2. 向量检索（Vectorize API 返回 top_k + node_id）
-- 3. 应用层融合去重并排序
4. 数据迁移策略
4.1 从 Fork 项目迁移
indonesian-legal-network-analysis 项目使用 Neo4j 存储数据。迁移脚本 scripts/ingest-from-official/ 负责：

导出 Neo4j 数据为 JSON（利用官方脚本）。

映射 Neo4j 标签（Label）到 D1 的 type。

映射 Neo4j 关系类型到 D1 的 relation_type。

分批插入 D1（避免事务过大）。

4.2 从 Pasal.id API 同步
调用 https://api.pasal.id/regulations 获取法规列表。

对每条法规调用 https://api.pasal.id/regulations/{id} 获取详情。

解析 JSON，提取条款内容，生成节点。

解析交叉引用，生成边。

增量更新（检测 updated_at 变化）。

5. 索引优化建议
表	索引	用途
nodes	idx_nodes_type	按法规类型过滤
nodes	idx_nodes_name	按名称模糊搜索
edges	idx_edges_source	正向关系遍历
edges	idx_edges_target	反向关系遍历
edges	idx_edges_relation	按关系类型过滤
edges	idx_edges_source_target	复合索引（加速路径查询）
sql
CREATE INDEX idx_edges_source_target ON edges(source_id, target_id);
