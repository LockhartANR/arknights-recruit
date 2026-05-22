<template>
  <div class="stats-page">
    <div class="card">
      <div class="flex-row">
        <label>选择年份：</label>
        <select v-model="selectedYear" class="select" @change="onYearChange">
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }} 年</option>
        </select>
        <template v-if="selectedYear">
          <label>选择月份：</label>
          <select v-model="selectedMonth" class="select" @change="onMonthChange">
            <option :value="null">全年</option>
            <option v-for="m in 12" :key="m" :value="m">{{ m }} 月</option>
          </select>
        </template>
      </div>
    </div>

    <div v-if="!availableYears.length" class="card text-muted">
      暂无数据，请先<a href="/" style="color:#409EFF">录入数据</a>
    </div>

    <div v-else-if="selectedMonth">
      <MonthlyStats
        :year="selectedYear"
        :month="selectedMonth"
        :stats="monthlyStats"
        :loading="loading"
      />
    </div>

    <div v-else>
      <YearStats
        :year="selectedYear"
        :stats="yearlyStats"
        :loading="loading"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useStats } from '../composables/useStats.js'
import YearStats from '../components/YearStats.vue'
import MonthlyStats from '../components/MonthlyStats.vue'

const {
  yearlyStats,
  monthlyStats,
  availableYears,
  loading,
  error,
  fetchYears,
  fetchYearlyStats,
  fetchMonthlyStats
} = useStats()

const selectedYear = ref(null)
const selectedMonth = ref(null)

function onYearChange() {
  selectedMonth.value = null
  if (selectedYear.value) {
    fetchYearlyStats(selectedYear.value)
  }
}

function onMonthChange() {
  if (selectedYear.value && selectedMonth.value) {
    fetchMonthlyStats(selectedYear.value, selectedMonth.value)
  }
}

onMounted(async () => {
  await fetchYears()
  if (availableYears.value.length > 0) {
    selectedYear.value = availableYears.value[0]
    await fetchYearlyStats(selectedYear.value)
  }
})
</script>
