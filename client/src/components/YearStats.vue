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
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  year: { type: [String, Number], required: true },
  stats: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const chartRef = ref(null)
let chart = null

const STAR_COLORS = {
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
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>
