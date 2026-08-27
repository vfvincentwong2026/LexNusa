-- LexNusa D1 Schema v1.0（依据 docs/DATA_MODEL.md v1.0.1 修正版）
-- 节点-边模型 + 向量元数据（P2 启用）

CREATE TABLE IF NOT EXISTS nodes (
  id            TEXT PRIMARY KEY,          -- 紧凑 id，如 uu_2007_25 / uu_2007_25_pasal_5
  name          TEXT NOT NULL,             -- 法规/条款名称（印尼语原名）
  type          TEXT NOT NULL,             -- UU / PP / PERPRES / PERPPU / PERMEN / PERDA / ARTICLE / ENTITY
  content       TEXT,                      -- 条款正文（印尼语原文）
  description   TEXT,                      -- 摘要描述
  metadata      TEXT,                      -- 扩展元数据（JSON 字符串）
  frbr_uri      TEXT UNIQUE,               -- Pasal.id FRBR URI，如 /akn/id/act/uu/2007/25
  status        TEXT,                      -- berlaku / diubah / dicabut
  number        TEXT,                      -- 法规编号，如 "25"
  year          INTEGER,                   -- 年份，如 2007
  zh_title      TEXT,                      -- 中文译名
  zh_summary    TEXT,                      -- 中文一句话摘要
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_year ON nodes(year);

CREATE TABLE IF NOT EXISTS edges (
  id            TEXT PRIMARY KEY,          -- source_id|relation_type|target_id
  source_id     TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  relation_type TEXT NOT NULL,             -- AMENDS / REPEALS / REFERENCES / IMPLEMENTS / REVIEWS / REPLACES / DERIVES_FROM / RELATED_TO
  metadata      TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES nodes(id),
  FOREIGN KEY (target_id) REFERENCES nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(relation_type);
CREATE INDEX IF NOT EXISTS idx_edges_source_target ON edges(source_id, target_id);

CREATE TABLE IF NOT EXISTS vector_meta (
  id                TEXT PRIMARY KEY,
  node_id           TEXT NOT NULL,
  chunk_text        TEXT NOT NULL,
  vectorize_index   TEXT NOT NULL,
  embedding_model   TEXT DEFAULT 'bge-m3',
  char_start        INTEGER,
  char_end          INTEGER,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_vector_meta_node ON vector_meta(node_id);
