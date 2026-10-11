<template>
  <div class="stats-page">
    <div class="card">
      <div class="flex-row">
        <label>选择年份：</label>
        <select v-model="selectedYear" class="select">
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }} 年</option>
        </select>
        <template v-if="selectedYear">
          <label>选择月份：</label>
          <select v-model="selectedMonth" class="select">
            <option :value="null">全年</option>
            <option v-for="m in 12" :key="m" :value="m">{{ m }} 月</option>
          </select>
        </template>
      </div>
    </div>

    <div v-if="!availableYears.length" class="card text-muted">
      暂无数据，请先<a href="/" style="color:#409EFF">录入数据</a>
    </div>

    <template v-else>
      <SummaryCards
        v-if="summaryStats"
        :year="selectedYear"
        :month-label="selectedMonth"
        :stats="summaryStats"
        :year-avg-per-active-month="yearAvgPerActiveMonth"
      />

      <!-- 趋势放在明细之前：先看整体走势，再落到具体数字 -->
      <TrendChart
        v-if="!selectedMonth && trend"
        :year="selectedYear"
        :trend="trend"
        :loading="loading"
      />

      <MonthlyStats
        v-if="selectedMonth"
        :year="selectedYear"
        :month="selectedMonth"
        :stats="monthlyStats"
        :loading="loading"
      />
      <YearStats
        v-else
        :year="selectedYear"
        :stats="yearlyStats"
        :loading="loading"
      />

      <div v-if="exportableStats" class="card">
        <div class="flex-between">
          <span class="text-muted">把当前统计导出为 CSV，可用 Excel 打开</span>
          <button class="btn btn-sm btn-default" @click="exportCsv">导出 CSV</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useStats } from '../composables/useStats.js'
import YearStats from '../components/YearStats.vue'
import MonthlyStats from '../components/MonthlyStats.vue'
import SummaryCards from '../components/SummaryCards.vue'
import TrendChart from '../components/TrendChart.vue'

const {
  yearlyStats,
  monthlyStats,
  trend,
  availableYears,
  loading,
  fetchYears,
  fetchYearlyStats,
  fetchMonthlyStats,
  fetchTrend
} = useStats()

const selectedYear = ref(null)
const selectedMonth = ref(null)

// 当前视图对应的一份 breakdown，供导出复用
const currentStats = computed(() =>
  selectedMonth.value ? monthlyStats.value : yearlyStats.value
)

// 月度概览的「与月均相比」需要全年基线，它来自趋势端点的 summary。
// 进过全年视图后 trend 就有值；若用户直接落在月度视图则可能为 null，
// 此时少显示那两张卡，其余内容不受影响。
const yearAvgPerActiveMonth = computed(
  () => trend.value?.summary?.avgPerActiveMonth ?? null
)

const summaryStats = computed(() => {
  if (!selectedYear.value) return null

  if (!selectedMonth.value) {
    // 年度：后端已算好，直接用
    return trend.value?.summary || null
  }

  // 月度：/stats 只返回 breakdown，这里现算。
  // 只有 6 个星级、一个月的量，不值得为它再加一个端点。
  const stats = monthlyStats.value
  if (!stats || !stats.breakdown) return null

  // 平均星级：按次数加权。它把 1~6★ 整条分布压成一个数，
  // 直接回答「这个月整体出得高不高」。
  let weighted = 0
  let fourPlus = 0
  for (const b of stats.breakdown) {
    weighted += b.star * b.count
    if (b.star >= 4) fourPlus += b.count
  }
  const total = stats.total || 0

  return {
    yearTotal: total,
    totalDays: stats.totalDays || 0,
    avgStar: total > 0 ? Math.round((weighted / total) * 100) / 100 : null,
    fourPlusCount: fourPlus,
    fourPlusPct: total > 0 ? Math.round((fourPlus / total) * 1000) / 10 : null
  }
})

const exportableStats = computed(() => {
  const s = currentStats.value
  return s && s.breakdown ? s : null
})

// 年份或月份一变就重新取数。
// 趋势只在全年视图需要，月度视图不发请求，省一次往返。
watch([selectedYear, selectedMonth], ([year, month]) => {
  if (!year) return
  if (month) {
    fetchMonthlyStats(year, month)
  } else {
    fetchYearlyStats(year)
    fetchTrend(year)
  }
})

function exportCsv() {
  const stats = exportableStats.value
  if (!stats) return

  const scope = selectedMonth.value
    ? `${selectedYear.value}年${selectedMonth.value}月`
    : `${selectedYear.value}年`
  const lines = [
    ['范围', '星级', '次数', '占比(%)'],
    ...stats.breakdown.map(b => [scope, `${b.star}星`, b.count, b.percentage]),
    [scope, '合计', stats.total, 100]
  ]

  // BOM 开头，否则 Excel 打开中文会乱码
  const csv = '\uFEFF' + lines.map(row => row.join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `公招统计-${scope}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await fetchYears()
  if (availableYears.value.length > 0) {
    selectedYear.value = availableYears.value[0]
    await fetchYearlyStats(selectedYear.value)
    await fetchTrend(selectedYear.value)
  }
})
</script>
