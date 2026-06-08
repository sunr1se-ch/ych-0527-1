# 盐渍菜池发酵液位与pH联动看板

## 项目简介

本系统是一个用于监测盐渍菜池发酵过程中液位与pH值变化的可视化看板，支持多维度数据分析和邻池pH差异对比。

## 功能特性

- 📊 **组别筛选**：按菜池组别筛选数据
- 📅 **日期范围**：自定义查询时间范围
- 📈 **pH柱状图**：各菜池期内pH均值对比
- 🔍 **邻池pH差散点图**：同组相邻菜池pH差值分析
- 📐 **池组布设示意**：可视化展示菜池布局
- 📉 **趋势对比图**：液位与pH双轴趋势分析
- 📥 **数据导入**：支持CSV批量导入和手动录入
- 📤 **数据导出**：支持多种格式导出筛选结果
- 📋 **数据表格**：详细统计数据展示

## 数据说明

### 菜池档案 (ponds.csv)
| 字段 | 说明 | 示例 |
|------|------|------|
| 池号 | 菜池唯一标识 | A01 |
| 所在组 | 所属组别 | A组 |
| 设计液位厘米 | 设计液位高度 | 150 |

### 每日记录 (records.csv)
| 字段 | 说明 | 示例 |
|------|------|------|
| 池号 | 菜池标识 | A01 |
| 记录日期 | 记录日期 | 2026-06-01 |
| 实测液位厘米 | 实际测量液位 | 145 |
| pH | pH值 | 6.2 |
| 表层盐花厚度毫米 | 盐花厚度 | 1.2 |

### 统计指标

1. **日均值计算**：对每池每天的液位、pH、盐花厚度取平均值
2. **期内均值**：在选定日期范围内计算各指标均值
3. **邻池pH差值**：同组内按池号排序，计算相邻两池期内pH均值的绝对差值

## 快速开始

### 方式一：Docker 一键运行（推荐）

```bash
# 构建并启动
docker-compose up -d --build

# 访问应用
# 打开浏览器访问 http://localhost:5000

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 方式二：本地直接运行

```bash
# 安装依赖
pip install -r requirements.txt

# 启动应用
python app.py

# 访问 http://localhost:5000
```

## 项目结构

```
.
├── app.py                    # Flask主应用
├── data_loader.py            # 数据加载和业务逻辑
├── requirements.txt          # Python依赖
├── Dockerfile               # Docker镜像配置
├── docker-compose.yml       # Docker编排配置
├── templates/
│   └── index.html           # 前端页面
├── static/
│   ├── css/
│   │   └── style.css        # 样式文件
│   └── js/
│       └── app.js           # 前端逻辑
└── data/
    ├── ponds.csv            # 菜池档案
    ├── records.csv          # 每日记录
    └── sample_new_records.csv  # 示例导入文件
```

## API接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/groups` | GET | 获取所有组别 |
| `/api/date-range` | GET | 获取数据日期范围 |
| `/api/ponds` | GET | 获取菜池列表 |
| `/api/daily-averages` | GET | 获取日均值统计 |
| `/api/period-averages` | GET | 获取期内均值统计 |
| `/api/adjacent-ph-diff` | GET | 获取邻池pH差值 |
| `/api/group-layout` | GET | 获取池组布局 |
| `/api/summary` | GET | 获取汇总统计 |
| `/api/records` | POST | 批量添加记录 |
| `/api/import-csv` | POST | CSV文件导入 |
| `/api/export` | GET | 导出数据 |

## 使用说明

1. **筛选数据**：选择组别和日期范围，点击"查询"按钮
2. **查看图表**：通过四个可视化图表分析数据
3. **导入数据**：点击"导入记录"，可选择CSV导入或手动录入
4. **导出数据**：点击"导出"，选择需要导出的数据类型

## 技术栈

- **后端**：Python 3.11 + Flask 3.0 + Pandas
- **前端**：HTML5 + CSS3 + JavaScript + ECharts 5.4
- **数据存储**：CSV文件（轻量级，无需数据库）
- **容器化**：Docker + Docker Compose

## 注意事项

- CSV文件需使用UTF-8编码（带BOM）
- 导入的CSV必须包含：池号、记录日期、实测液位厘米、pH、表层盐花厚度毫米
- 同一池号同一天的重复记录会被覆盖，保留最新数据
- 数据文件挂载在 `./data` 目录，容器重启数据不会丢失
