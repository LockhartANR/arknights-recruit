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

### 5. 图表必须检测「容器元素被替换」——最隐蔽的一个

这是本页所有坑里最难找的。现象很有迷惑性：

| 切换 | 饼图 |
|---|---|
| 全年 → 某月 | 正常 |
| 某月 → 全年 | 正常 |
| **某月 → 另一月** | **消失** |
| 刚刷新后看全年 | **也是空的**，切一下月份再回来才有 |

**根因**：Vue 在数据变化时会重建 `v-else-if` 所在的元素。实测日志里的证据：

```
[d] stats watch {hasChart: true, hasRef: true, total: 1037, sameEl: false}
[d] updateChart {hasChart: true, hasStats: true}
[d] setOption 完成 {canvas: 0}
```

`sameEl: false` 说明 `.chart-box` 被换成了新元素。而代码只判断 `chart` 是否为空、
**从不检查它绑的是不是当前那个元素**：

1. 容器被重建 → `chart` 仍指向**已被丢弃的旧元素**（canvas 在旧元素里，不在页面上）
2. `if (!chart)` 为假 → 走 `updateChart()` → `setOption()` 把数据画进**旧元素**
3. 新容器永远得不到 canvas

所以不是「图没画」，而是**画到了一个已经不在页面上的元素里**。

**修法**：用元素身份检测，变了就销毁重建。三个入口统一走它：

```js
function ensureChart() {
  if (!chartRef.value) return
  if (chart && chartEl !== chartRef.value) {   // 容器换了
    chart.dispose()
    chart = null
    chartEl = null
  }
  if (!chart) initChart()      // 在新容器上重建
  else updateChart()
}
```

调用点：`watch(() => props.stats)`、`watch(chartRef)`、`ResizeObserver` 回调。

**通用结论**：任何把实例绑定到 DOM 元素的库（ECharts、Chart.js、地图、编辑器）
都要做这个检查。只判「实例是否存在」不够 —— **实例存在但它绑的元素已被替换**，
是这类 bug 的共同形态。

### 6. 排查这类问题的正确顺序（我走了六轮弯路）

这个 bug 我改了六次才对，前五次都是**在看不到渲染结果的情况下推测**：

| 轮次 | 假设 | 结果 |
|---|---|---|
| 1 | 漏了 `onMounted` 初始化 | 补了，但元素那时还不存在 |
| 2 | 容器宽度为 0 | 加了检查，同上 |
| 3 | 月度数据没拿到 | **错**，日志证明 API 一直正常 |
| 4 | `canvas: 0` 说明渲染失败 | **假信号**，下一帧就有 canvas |
| 5 | 改用 `watch(chartRef)` | 对了一部分，未覆盖「容器被替换」 |
| 6 | 容器身份变化未检测 | 真正根因 |

**正确的顺序**：

1. **先在每一步加日志**，而不是先改逻辑
2. **让用户提供 DOM 证据**（`clientWidth`、`canvas` 数、`sameEl`），
   这些是浏览器才能给出的、无法推测的事实
3. 证据指向哪就改哪

两个具体教训：

- `echarts.init()` 之后**立刻**查 `querySelectorAll('canvas').length` 是 0，
  下一帧才变 1。**别把这个瞬态当成失败信号** —— 我差点因此去改没坏的东西。
- `watch(() => props.stats)` 默认在**渲染前**触发，那时 `chartRef` 还是 null，
  实测日志为 `{hasRef: false}`。需要在渲染后跑就用 `{ flush: 'post' }`。

### 7. 测试时如何正确签一个 token（我在这里冤枉过应用一次）

后端端点都要求 `Authorization: Bearer <JWT>`。临时签一个即可绕过登录做端到端调用，
**但有个坑会让人误判成服务故障**：

```bash
# ✗ 错：dotenv v17 会往 stdout 打一行 "[dotenv@17] injecting env..."，
#      被 $(...) 一起捕获，token 里混进文字与换行
T=$(cd server && node -e "require('dotenv').config();     process.stdout.write(require('jsonwebtoken').sign({id:1}, process.env.JWT_SECRET))")
# 症状：每个统计端点都返回 400 Bad Request、响应体为空、耗时不到 1 毫秒
#       （Express 拒绝非法请求头），经 nginx 则是 curl 退出码 43 / HTTP 000
```

```bash
# ✓ 对：显式关闭 dotenv 的输出
T=$(cd server && DOTENV_CONFIG_QUIET=true node -e "
  require('dotenv').config({ quiet: true });
  process.stdout.write(require('jsonwebtoken').sign(
    { id: 1, username: 'verify' }, process.env.JWT_SECRET, { expiresIn: '10m' }));
")
# 自检：JWT 应为 157 字符左右、恰好 2 个点号、不含任何空白字符
printf 'len=%s dots=%s ws=%s\n' "${#T}" "$(printf '%s' "$T" | tr -cd '.' | wc -c)" \
  "$(printf '%s' "$T" | grep -c '[[:space:]]')"
```

**教训**：`400 Bad Request` + 空响应体 + 亚毫秒耗时，说明请求**在到达路由前就被拒了**，
这更像调用方的问题（非法请求头），而不是服务端逻辑错误。
遇到这种组合先检查自己发出去的请求。

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
