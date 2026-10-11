<template>
  <div>
    <div class="card">
      <h2 class="card-title">{{ year }} 年 年度统计</h2>
      <div v-if="loading" class="text-muted">加载中...</div>
      <template v-else-if="stats">
        <div class="stats-grid">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>星级</th>
                  <th>次数</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in stats.breakdown" :key="item.star">
                  <td :class="`star-${item.star}`">{{ item.star }}★</td>
                  <td>{{ item.count }}</td>
                  <td>{{ item.percentage }}%</td>
                </tr>
                <tr style="font-weight:600">
                  <td>合计</td>
                  <td>{{ stats.total }}</td>
                  <td>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div ref="chartRef" class="chart-box"></div>
        </div>
      </template>
      <div v-else class="text-muted">暂无数据</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
// 按需引入（饼图/tooltip/legend），替代整包 `import * as echarts from 'echarts'`
import echarts from '../utils/echarts.js'

const props = defineProps({
  year: { type: [String, Number], required: true },
  stats: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const chartRef = ref(null)
let chart = null

const STAR_COLORS = {
  1: '#C8CDD4',
  2: '#A9B2BE',
  3: '#909399',
  4: '#409EFF',
  5: '#E6A23C',
  6: '#F56C6C'
}

function initChart() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  updateChart()
}

function updateChart() {
  if (!chart || !props.stats) return

  const data = props.stats.breakdown
    .filter(item => item.count > 0)
    .map(item => ({
      value: item.count,
      name: `${item.star}★`,
      itemStyle: { color: STAR_COLORS[item.star] }
    }))

  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}次 ({d}%)'
    },
    legend: {
      bottom: 0
    },
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      label: {
        show: true,
        formatter: '{b}\n{d}%'
      },
      emphasis: {
        label: { show: true, fontSize: 18 }
      },
      data
    }]
  })
}

function handleResize() {
  chart?.resize()
}

watch(() => props.stats, () => {
  if (!chart) initChart()
  else updateChart()
}, { deep: true })

onMounted(() => {
  // 必须在这里初始化一次图表。
  // 此前只注册了 resize 监听、没有 initChart()，导致一个问题：
  // 父组件用 v-if="stats" 挂载本组件，也就是**数据到位后才挂载**。
  // 挂载时数据已在 props 里，watch 不会再触发，
  // 于是图表永远不初始化 —— 那块区域一直空白，
  // 只有切换年/月让 props 变化时才画出来。
  nextTick(initChart)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>
