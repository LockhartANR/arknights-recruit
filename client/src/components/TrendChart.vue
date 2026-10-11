<template>
  <div class="card">
    <div class="flex-between">
      <h2 class="card-title" style="margin-bottom:0">{{ year }} 年 月度趋势</h2>
      <div class="trend-toggle">
        <button
          class="btn btn-sm"
          :class="mode === 'stacked' ? 'btn-primary' : 'btn-default'"
          @click="setMode('stacked')"
        >星级构成</button>
        <button
          class="btn btn-sm"
          :class="mode === 'total' ? 'btn-primary' : 'btn-default'"
          @click="setMode('total')"
        >总量</button>
      </div>
    </div>
    <div ref="chartRef" class="chart-box" style="height:400px"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
// 按需引入。新增图表类型必须确认 utils/echarts.js 里已注册对应项，
// 否则 init() 时不会报错，但图表区域会是空白 —— 这是最容易踩的坑。
import echarts from '../utils/echarts.js'

const props = defineProps({
  year: { type: [String, Number], required: true },
  // 后端返回的 { months: [{ month, total, stars: {1..6}, days }], ... }
  trend: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const chartRef = ref(null)
let chart = null
// 默认看星级构成：总量单独一条柱子信息量太少，堆叠能一次看出「几月多」和「出的都是几星」
const mode = ref('stacked')

// 与饼图、表格、概览卡片共用同一套配色
const STAR_COLORS = {
  1: '#C8CDD4',
  2: '#A9B2BE',
  3: '#909399',
  4: '#409EFF',
  5: '#E6A23C',
  6: '#F56C6C'
}

function setMode(m) {
  mode.value = m
  updateChart()
}

function buildSeries() {
  const months = props.trend?.months || []
  const axis = months.map(m => `${m.month} 月`)

  if (mode.value === 'total') {
    return {
      axis,
      series: [{
        name: '总次数',
        type: 'bar',
        barMaxWidth: 48,
        itemStyle: { color: '#409EFF', borderRadius: [4, 4, 0, 0] },
        data: months.map(m => m.total)
      }]
    }
  }

  // 堆叠：1★ 在最下、6★ 在最上，与表格里的星级顺序一致
  const series = []
  for (let star = 1; star <= 6; star++) {
    series.push({
      name: `${star}★`,
      type: 'bar',
      stack: 'stars',
      barMaxWidth: 48,
      itemStyle: { color: STAR_COLORS[star] },
      // 为 0 的月份不显示，避免 tooltip 里全是 0 干扰阅读
      data: months.map(m => m.stars[star] || 0)
    })
  }
  return { axis, series }
}

function updateChart() {
  if (!chart || !props.trend) return
  const { axis, series } = buildSeries()

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: { bottom: 0 },
    grid: { left: 48, right: 20, top: 24, bottom: 48 },
    xAxis: {
      type: 'category',
      data: axis,
      axisTick: { alignWithLabel: true }
    },
    yAxis: {
      type: 'value',
      minInterval: 1
    },
    series
  }, true) // notMerge：切换模式时替换 series，避免残留上一种模式的数据
}

function initChart() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  updateChart()
}

function handleResize() {
  chart?.resize()
}

watch(() => props.trend, () => {
  if (!chart) initChart()
  else updateChart()
}, { deep: true })

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>
