<template>
  <div class="card">
    <div class="flex-between hm-head">
      <h2 class="card-title" style="margin-bottom:0">{{ year }} 年 每日招募</h2>
      <div class="hm-legend">
        <span class="hm-legend-label">少</span>
        <span
          v-for="(lv, i) in levels"
          :key="i"
          class="hm-cell"
          :class="`hm-lv-${i}`"
        ></span>
        <span class="hm-legend-label">多</span>
      </div>
    </div>

    <div ref="scrollRef" class="hm-scroll">
      <div class="hm-inner">
        <div class="hm-weekdays">
          <span v-for="(wd, i) in WEEKDAYS" :key="i" class="hm-weekday">{{ wd }}</span>
        </div>

        <div class="hm-body">
          <!-- 月份标签：与下方格子同用一套网格，保证同列对齐 -->
          <div class="hm-months" :style="gridStyle">
            <span
              v-for="m in monthLabels"
              :key="m.month"
              class="hm-month-label"
              :style="{ gridColumn: m.col }"
            >{{ m.month }}月</span>
          </div>

          <div class="hm-grid" :style="gridStyle" @mouseleave="hide">
            <span
              v-for="(cell, i) in cells"
              :key="i"
              class="hm-cell"
              :class="cell.inYear ? (cell.level < 0 ? 'hm-cell-blank' : `hm-lv-${cell.level}`) : 'hm-cell-out'"
              @mouseenter="show(cell, $event)"
            ></span>
          </div>
        </div>
      </div>
    </div>

    <div class="hm-summary text-muted">
      有记录的 <strong>{{ activeDays }}</strong> 天，共 {{ totalCount }} 次；
      单日最多 <strong>{{ maxCount }}</strong> 次<template v-if="maxDate">（{{ maxDate }}）</template>
    </div>

    <!--
      自定义浮层，而不是格子的 title 属性。
      原因：格子里只有 10px，原生提示要等约 1 秒、在这个尺寸上还常常不触发 ——
      实测悬停什么都不显示。GitHub 自己用的也是自定义浮层。
    -->
    <div
      v-if="tip.show"
      class="hm-tip"
      :style="{ left: tip.x + 'px', top: tip.y + 'px' }"
    >{{ tip.text }}</div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  year: { type: [String, Number], required: true },
  // 后端 /stats/trend 返回的 { total, days: [{ date: 'YYYY-MM-DD', count: n }] }
  trend: { type: Object, default: null }
})

// 分档刻意不用 GitHub 那套 1/2-3/4-7/8+。
// 实测本站单日次数集中在 4 和 8（分别 81 天、43 天），
// 若照搬那套分档，81 天会全部落进同一档，整张图几乎一个颜色。
// 这里按真实分布的自然断点分档：1-4 / 5-7 / 8-11 / 12-19 / 20+。
const levels = [
  { max: 4 },
  { max: 7 },
  { max: 11 },
  { max: 19 },
  { max: Infinity }
]

// 只标出周一、三、五、日：七行全标在 10px 行高下会挤成一团
const WEEKDAYS = ['一', '', '三', '', '五', '', '日']
const DAY = 86400000

// 格子尺寸的上下限（px）。低于下限看不清，高于上限显得松散。
const CELL_MIN = 6
const CELL_MAX = 14

function ymd(d) {
  return d.toISOString().slice(0, 10)
}

// 网格起点：包含 1 月 1 日的那一周的周一（与 WEEKDAYS 对应）
const start = computed(() => {
  const first = new Date(Date.UTC(Number(props.year), 0, 1))
  const dow = (first.getUTCDay() + 6) % 7 // 0 = 周一
  return new Date(first.getTime() - dow * DAY)
})

// 覆盖整年所需的列数（最多 53）
const weeks = computed(() => {
  const first = new Date(Date.UTC(Number(props.year), 0, 1))
  const dow = (first.getUTCDay() + 6) % 7
  const isLeap = new Date(Date.UTC(Number(props.year), 1, 29)).getUTCMonth() === 1
  const yearDays = isLeap ? 366 : 365
  return Math.ceil((dow + yearDays) / 7)
})

// ---- 自适应尺寸 ----
//
// 为什么要在 JS 里测量，而不是用 CSS calc + 100vw：
// .main 有 max-width: 960px，宽屏时内容宽度被它限制，
// 用视口宽度推导会算出与实际无关的结果（1920px 下会得出 31px 的格子）。
// ResizeObserver 读到的才是真实可用宽度。
const scrollRef = ref(null)
const availWidth = ref(0)
const gapPx = computed(() => (availWidth.value && availWidth.value < 640 ? 2 : 3))

const cellPx = computed(() => {
  const avail = availWidth.value
  if (!avail) return CELL_MAX
  // 减去周标签列与其间距（20px），剩下的是网格可用宽度
  const grid = avail - 20
  const raw = (grid - (weeks.value - 1) * gapPx.value) / weeks.value
  return Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(raw * 10) / 10))
})

// 列宽与格子宽度必须来自同一个值，否则会变成长方形。
// 同时注入 --hm-cell-w 给 .hm-cell 用（见 main.css 里的说明）。
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${weeks.value}, ${cellPx.value}px)`,
  '--hm-cell-w': `${cellPx.value}px`,
  '--hm-gap': `${gapPx.value}px`
}))

let ro = null

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !scrollRef.value) return
  ro = new ResizeObserver(entries => {
    for (const e of entries) availWidth.value = e.contentRect.width
  })
  ro.observe(scrollRef.value)
  availWidth.value = scrollRef.value.clientWidth
})

onUnmounted(() => {
  ro?.disconnect()
  ro = null
})

const countByDate = computed(() => {
  const map = new Map()
  for (const d of props.trend?.days || []) map.set(d.date, d.count)
  return map
})

const cells = computed(() => {
  const y = Number(props.year)
  const total = weeks.value * 7
  const out = new Array(total)
  for (let i = 0; i < total; i++) {
    const d = new Date(start.value.getTime() + i * DAY)
    if (d.getUTCFullYear() !== y) {
      out[i] = { inYear: false, level: -1, date: '', count: 0, text: '' }
      continue
    }
    const key = ymd(d)
    const n = countByDate.value.get(key) || 0
    let level = -1
    if (n > 0) {
      level = levels.findIndex(l => n <= l.max)
      if (level < 0) level = levels.length - 1
    }
    out[i] = {
      inYear: true,
      level,
      date: key,
      count: n,
      text: n > 0 ? `${key}　${n} 次` : `${key}　无记录`
    }
  }
  return out
})

const monthLabels = computed(() => {
  const out = []
  const y = Number(props.year)
  for (let m = 0; m < 12; m++) {
    const first = new Date(Date.UTC(y, m, 1))
    const col = Math.floor((first.getTime() - start.value.getTime()) / DAY / 7) + 1
    // 与上一个标签同列则跳过，避免文字重叠
    if (out.length && col <= out[out.length - 1].col) continue
    out.push({ month: m + 1, col })
  }
  return out
})

const activeDays = computed(() => cells.value.filter(c => c.inYear && c.level >= 0).length)

// 直接取后端的 total，避免在这里再累加一遍
const totalCount = computed(() => props.trend?.total ?? 0)

const maxEntry = computed(() => {
  const list = props.trend?.days || []
  if (!list.length) return null
  return list.reduce((a, b) => (b.count > a.count ? b : a))
})
const maxCount = computed(() => maxEntry.value?.count ?? 0)
const maxDate = computed(() => maxEntry.value?.date ?? '')

// ---- 悬停提示 ----
const tip = reactive({ show: false, x: 0, y: 0, text: '' })
const TIP_OFFSET = 14

function show(cell, ev) {
  if (!cell.inYear) return
  tip.text = cell.text
  // 用视口坐标（fixed 定位），并在靠近上边缘时翻到下方，避免被裁掉
  tip.x = ev.clientX + TIP_OFFSET
  tip.y = ev.clientY < 60 ? ev.clientY + TIP_OFFSET : ev.clientY - 34
  tip.show = true
}

function hide() {
  tip.show = false
}
</script>