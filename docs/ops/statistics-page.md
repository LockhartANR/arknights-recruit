# 统计页功能说明（公招）

对应 issue #4「强化统计页面功能」。本文记录**做了什么、为什么没做其余的**，
以及两个只在构建产物里才能发现的坑。

## 一、先排除的方向（附数据依据）

issue 列了 7 个方向并注明「不需要全做」。动手前先核对了数据库，
有三项据此排除：

| 方向 | 数据现实 | 结论 |
|---|---|---|
| 按干员统计 / Top N 排行 | `records.operator_id` 仅 **19/1037 = 1%** 填充 | **做不了**，做出来是假数据 |
| 标签组合统计 | `records` 表**没有标签字段** | 做不了 |
| 时间段对比（本月 vs 上月） | 只有 **2026 一年**数据 | 年份对比无意义，改为月趋势 |

`operator_id` 填充率低的原因：记录以**星级**为单位录入，干员选择器是后来才加的，
历史数据没有这一维。**要让「干员排行」能用，得先补数据，不是先写代码。**

复现这个判断：

```bash
python3 -c "
import sqlite3; c=sqlite3.connect('server/data.db')
tot=c.execute('select count(*) from records').fetchone()[0]
has=c.execute('select count(*) from records where operator_id is not null').fetchone()[0]
print(f'{has}/{tot} = {has*100//tot}%')"
```

## 二、实现的四项

| 功能 | 文件 | 说明 |
|---|---|---|
| 数据大盘概览 | `components/SummaryCards.vue` | 总次数、活跃月份数、月均、最多/最少月份、最常出的星级、记录天数 |
| 月度趋势图 | `components/TrendChart.vue` | 堆叠柱状图，12 个月补零；可切换「星级构成 / 总量」 |
| CSV 导出 | `views/StatisticsPage.vue` | 纯前端生成，BOM 开头避免 Excel 中文乱码 |
| 趋势端点 | `server/routes/records.js` | `GET /api/records/stats/trend?year=YYYY` |

### 为什么趋势图用堆叠柱状图

总量单柱只能看出「哪个月多」。堆叠后一张图同时给出总量与星级构成 ——
这在数据里很实用：3★ 长期占 74%（764/1037），而 1★/2★ 只在 7、8 月出现。

### 为什么趋势单独一个端点

`/stats` 是「某年或某月」的聚合，前端要画全年趋势得发 12 次请求。
一个 `GROUP BY month, stars` 就够，交给 SQLite 算远快于 12 次往返。

**返回 12 个月全部补零**，前端因此不必处理缺月，
也不会出现「只有有数据的月份才画柱子」导致时间轴被压缩。

### ⚠️ 端点注册顺序

```js
router.get('/stats/years', ...)   // 287
router.get('/stats/trend', ...)   // 309  ← 必须在 /stats 之前
router.get('/stats', ...)         // 404
```

Express 按注册顺序匹配。若 `/stats` 在前，`/stats/trend` 会被它先匹配掉。

## 三、两个只在产物里才能发现的坑

### 1. ECharts 按需注册：漏了不报错，图表只是空白

`client/src/utils/echarts.js` 是集中注册处。本次加柱状图时追加了
`BarChart` 与 `GridComponent`（**`GridComponent` 是柱状图必需**，
缺了 xAxis/yAxis 不生效）。

漏注册**不会抛错**，图表区域就是一片空白。这个文件顶部有明确警示。

### 2. 函数写了但忘了导出：功能静默失效

第一版把 `fetchTrend` 写进 `useStats.js` 却**漏了从 `return` 里导出**。
后果：组件里它是 `undefined`，趋势图**永远不加载数据、不报错、只是空白**。

**发现方式**（值得复用）：构建后对产物做静态检查 ——

```bash
SP=$(ls client/dist/assets/StatisticsPage-*.js | head -1)
grep -o 'fetchTrend'          "$SP" | wc -l   # 期望 ≥1
grep -o 'stats/trend'         "$SP" | wc -l   # 期望 ≥1
grep -o '获取趋势统计失败'      "$SP" | wc -l   # 期望 1
```

函数定义了、但它引用的字符串没进产物，就说明**调用点被丢掉了**。

根因是字符串替换的锚点写错：该文件 `return` 块结尾是 `}\n}`（**没有分号**），
按 `};` 去匹配就静默失败了。**改这类文件后一定要回读确认改动真的落盘。**

### 3. 图表在挂载时没初始化：又是「不报错、只空白」

`YearStats.vue` / `MonthlyStats.vue` 的饼图代码一直都在，但**首次挂载时从不初始化**：

```js
watch(() => props.stats, () => { if (!chart) initChart(); ... })

onMounted(() => {
  window.addEventListener('resize', handleResize)   // 只加了监听
})                                                   // 没有 initChart()
```

父组件用 `v-if="stats"` 挂载，即**数据到位后才挂载**。挂载时数据已在 props 里，
`watch` 不会再触发 —— 图表永远不初始化，那块区域一直空白。
只有切换年/月让 props 变化时才会画出来。

修复：`onMounted` 里 `nextTick(initChart)`（等 DOM 就绪，ECharts 需要已挂载
且有尺寸的容器，否则按 0 尺寸渲染）。

**为什么 `TrendChart.vue` 没这个问题**：它从一开始就在 `onMounted` 里调了
`initChart()`。这也解释了当时的现象 —— 趋势图正常、饼图空白。

**规律**：凡是「图表/画布类」组件，`onMounted` 里必须有初始化调用。
只靠 `watch(props)` 不够，因为组件常被 `v-if` 在数据到位后才挂载。

### 4. 静态检查本身也会骗人

验证修复时我用 `grep -o 'nextTick' 产物.js` 得到 0 次，一度以为没生效。
实际是**压缩器把 `nextTick` 重命名成了 `i`**。

所以检查产物要用**结构特征**而非符号名，例如搜 `addEventListener(`resize``
再往前看它前面是否跟着初始化调用：

```bash
grep -oE '.{130}addEventListener\(`resize`.{60}' StatisticsPage-*.js
# 期望看到 g(()=>{ i(u), window.addEventListener(`resize`,y) })
#                     ↑ nextTick(initChart) 被重命名后的样子
```

## 四、验证方式与边界

后端可用直查 SQLite 与端点返回对账（脚本里用 `JWT_SECRET` 签个临时 token
即可绕过登录做端到端调用）。基线（2026-10-11）：

```
年度总计 1037   活跃月份 8   月均 129.6
最多 7 月 193   最少 9 月 40   最常出 3★ 764   记录天数 147
```

**边界：产物静态检查不能替代浏览器验证。** 它只能证明代码被打包、
接线存在，不能证明图表画出来了。本次四项功能均由人工在浏览器确认过
（概览卡片、堆叠柱状图、模式切换、CSV 导出）。
纯前端改动的验收，最后一步必须有人看一眼。
