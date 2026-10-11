<template>
  <div class="card">
    <div class="flex-between hm-head">
      <h2 class="card-title" style="margin-bottom:0">{{ year }} 年 每日招募</h2>
      <div class="hm-legend">
        <span class="hm-legend-label">少</span>
        <span v-for="(max, i) in levels" :key="i" class="hm-legend-cell" :class="`hm-lv-${i}`"></span>
        <span class="hm-legend-label">多</span>
      </div>
    </div>

    <div ref="scrollRef" class="hm-scroll">
      <div class="hm-weekdays">
        <span v-for="(wd, i) in WEEKDAYS" :key="i" class="hm-weekday">{{ wd }}</span>
      </div>

      <div class="hm-body">
        <!-- 月份标签与下方格子同宽，靠 gridColumn 落在对应列上 -->
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

    <div class="hm-summary text-muted">
      有记录的 <strong>{{ activeDays }}</strong> 天，共 {{ totalCount }} 次；
      单日最多 <strong>{{ maxCount }}</strong> 次<template v-if="maxDate">（{{ maxDate }}）</template>
    </div>

    <!--
      自定义浮层，而不是格子的 title 属性。
      原因：格子只有 10px 上下，原生提示要等约 1 秒、在这个尺寸上常常不触发。
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
  trend: { type: Object, default: null }
})

// 分档刻意不用 GitHub 那套 1/2-3/4-7/8+。
// 实测本站单日次数集中在 4 和 8（分别 81 天、43 天），
// 照搬那套会让 81 天全落进同一档，整张图几乎一个颜色。
// 按真实分布的自然断点分档：1-4 / 5-7 / 8-11 / 12-19 / 20+。
const levels = [4, 7, 11, 19, Infinity]

// 只标周一、三、五、日：七行全标会挤成一团
const WEEKDAYS = ['一', '', '三', '', '五', '', '日']
const DAY = 86400000
const CELL_MIN = 6
const CELL_MAX = 14

function ymd(d) {
  return d.toISOString().slice(0, 10)
}

const start = computed(() => {
  const first = new Date(Date.UTC(Number(props.year), 0, 1))
  const dow = (first.getUTCDay() + 6) % 7 // 0 = 周一
  return new Date(first.getTime() - dow * DAY)
})

const weeks = computed(() => {
  const first = new Date(Date.UTC(Number(props.year), 0, 1))
  const dow = (first.getUTCDay() + 6) % 7
  const isLeap = new Date(Date.UTC(Number(props.year), 1, 29)).getUTCMonth() === 1
  return Math.ceil((dow + (isLeap ? 366 : 365)) / 7)
})

// ---- 尺寸 ----
//
// 关键：这里只做单向依赖 —— 测量 .hm-scroll 的宽度 → 算格子尺寸 → 注入列宽。
// 反过来（让容器宽度由网格内容决定，如 min-width: max-content）会造成循环：
// 容器宽度取决于网格，网格列宽又取决于容器宽度，flex 会把网格拉长去填满，
// 格子就被拉成横长方形。这个坑我踩过，别再改回去。
//
// 为什么用 JS 测而不是 CSS calc(100vw...)：.main 有 max-width: 960px，
// 宽屏上内容宽度被它固定，用视口宽度推导出来的值与真实可用宽度无关。
const scrollRef = ref(null)
const availWidth = ref(0)

const WEEKLBL = 20 // 周标签列宽 + 间距
const gapPx = computed(() => (availWidth.value < 640 ? 2 : 3))

const cellPx = computed(() => {
  const avail = availWidth.value
  if (!avail) return CELL_MAX
  const raw = (avail - WEEKLBL - (weeks.value - 1) * gapPx.value) / weeks.value
  return Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(raw * 10) / 10))
})

// 列宽与格子宽度必须来自同一个值，否则会变成长方形
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${weeks.value}, ${cellPx.value}px)`,
  gridTemplateRows: `repeat(7, var(--hm-h))`,
  '--hm-cell-w': `${cellPx.value}px`,
  gap: `${gapPx.value}px`
}))

let ro = null

function measure() {
  if (scrollRef.value) availWidth.value = scrollRef.value.clientWidth
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && scrollRef.value) {
    ro = new ResizeObserver(measure)
    ro.observe(scrollRef.value)
  } else {
    window.addEventListener('resize', measure)
  }
})

onUnmounted(() => {
  ro?.disconnect()
  ro = null
  window.removeEventListener('resize', measure)
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
      out[i] = { inYear: false, level: -1, text: '' }
      continue
    }
    const key = ymd(d)
    const n = countByDate.value.get(key) || 0
    let level = -1
    if (n > 0) {
      level = levels.findIndex(max => n <= max)
      if (level < 0) level = levels.length - 1
    }
    out[i] = { inYear: true, level, text: n > 0 ? `${key}　${n} 次` : `${key}　无记录` }
  }
  return out
})

const monthLabels = computed(() => {
  const out = []
  const y = Number(props.year)
  for (let m = 0; m < 12; m++) {
    const first = new Date(Date.UTC(y, m, 1))
    const col = Math.floor((first.getTime() - start.value.getTime()) / DAY / 7) + 1
    if (out.length && col <= out[out.length - 1].col) continue
    out.push({ month: m + 1, col })
  }
  return out
})

const activeDays = computed(() => cells.value.filter(c => c.inYear && c.level >= 0).length)
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
  tip.x = ev.clientX + TIP_OFFSET
  tip.y = ev.clientY < 60 ? ev.clientY + TIP_OFFSET : ev.clientY - 34
  tip.show = true
}

function hide() {
  tip.show = false
}
</script>
