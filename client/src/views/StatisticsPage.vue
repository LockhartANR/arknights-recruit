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
      <!-- 概览：把「总次数 / 最多最少的月份 / 最常出的星级 / 记录天数」一次说清 -->
      <SummaryCards
        v-if="summaryStats"
        :year="selectedYear"
        :month-label="selectedMonth"
        :stats="summaryStats"
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

// 当前视图对应的一份 breakdown，供导出与概览复用
const currentStats = computed(() =>
  selectedMonth.value ? monthlyStats.value : yearlyStats.value
)

// 概览数据。
//
// 全年视图直接用 /stats/trend 的 summary（后端已算好，含月均、记录天数）。
// 月度视图后端没有等价汇总，这里从 breakdown 现算 —— 只有 6 个星级、一个月的量，
// 成本可忽略，不值得为它再加一个端点。
const summaryStats = computed(() => {
  if (!selectedYear.value) return null

  if (!selectedMonth.value) {
    return trend.value?.summary || null
  }

  const stats = monthlyStats.value
  if (!stats || !stats.breakdown) return null

  let topStar = null
  let topStarCount = 0
  let lowCount = Infinity
  for (const b of stats.breakdown) {
    if (b.count > topStarCount) {
      topStarCount = b.count
      topStar = b.star
    }
    if (b.count < lowCount) lowCount = b.count
  }

  const hasAny = stats.total > 0
  return {
    yearTotal: stats.total,
    // 选了具体月份，有数据就是 1 个「活跃月」；没数据则是 0
    activeMonths: hasAny ? 1 : 0,
    avgPerActiveMonth: stats.total,
    peak: hasAny ? { month: selectedMonth.value, total: stats.total } : null,
    low: null, // 单月没有「最少的月份」可言，交给组件按 activeMonths 判断不显示
    totalDays: stats.totalDays || 0,
    topStar: topStarCount > 0 ? topStar : null,
    topStarCount
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
