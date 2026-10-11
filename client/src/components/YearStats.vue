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
let observer = null

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
  // 容器没有宽度时不要初始化：ECharts 会按 0 尺寸渲染，
  // 结果是空白且**不会自动恢复**。这种情况交给 watch(chartRef) 下次触发，
  // 或 onMounted 里的 ResizeObserver 补救。
  if (chartRef.value.clientWidth === 0) return
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

// 用尺寸驱动初始化，而不是只依赖 nextTick。
//
// 原因：ECharts 在容器宽度为 0 时会按 0 尺寸渲染，结果是**空白且不会自动恢复**。
// 而容器何时拿到真实宽度取决于父级布局，nextTick 之后并不保证已经完成 ——
// 实测现象是「首次进入有图，切换年/月后消失」。
//
// ResizeObserver 在容器真正拿到尺寸时才触发，因此是可靠的初始化时机。
// 保留 nextTick(initChart) 作为兜底：万一环境没有 ResizeObserver，
// 或容器尺寸早已确定不再变化，也能正常出图。
// 关键：监听 chartRef 本身，而不是在 onMounted/nextTick 里等。
//
// 踩过的坑：容器在这个组件的 v-else-if="stats" 分支内。
// 父组件挂载本组件时 stats 可能还没到，那块 DOM 没渲染，
// 因此 onMounted 与 nextTick 时 chartRef 都是 null ——
// 实测日志为 {hasRef: false}。此时无论怎么"等一个 tick"都拿不到元素。
//
// watch(chartRef) 在 ref 真正绑定到元素时触发，这才是可靠的初始化时机。
// ResizeObserver 只用于后续尺寸变化（如窗口缩放、布局变化）。
watch(chartRef, (el) => {
  if (!el || chart) return
  if (el.clientWidth === 0) return
  initChart()
})

onMounted(() => {
  window.addEventListener('resize', handleResize)

  if (typeof ResizeObserver !== 'undefined' && chartRef.value) {
    observer = new ResizeObserver(() => {
      if (!chart) {
        if (chartRef.value?.clientWidth > 0) initChart()
      } else {
        chart.resize()
      }
    })
    observer.observe(chartRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  observer?.disconnect()
  observer = null
  chart?.dispose()
  chart = null
})
</script>
