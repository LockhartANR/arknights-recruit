import { ref } from 'vue'
import { api } from '../utils/api.js'

export function useStats() {
  const yearlyStats = ref(null)
  const monthlyStats = ref(null)
  const availableYears = ref([])
  const loading = ref(false)
  const error = ref('')

  async function fetchYears() {
    try {
      const res = await api('/api/records/stats/years')
      availableYears.value = await res.json()
    } catch {
      error.value = '无法获取年份数据'
    }
  }

  async function fetchYearlyStats(year) {
    loading.value = true
    error.value = ''
    try {
      const res = await api(`/api/records/stats?year=${year}`)
      if (!res.ok) throw new Error()
      yearlyStats.value = await res.json()
    } catch {
      error.value = '获取年度统计失败'
      yearlyStats.value = null
    } finally {
      loading.value = false
    }
  }

  async function fetchMonthlyStats(year, month) {
    loading.value = true
    error.value = ''
    try {
      const res = await api(`/api/records/stats?year=${year}&month=${month}`)
      if (!res.ok) throw new Error()
      monthlyStats.value = await res.json()
    } catch {
      error.value = '获取月度统计失败'
      monthlyStats.value = null
    } finally {
      loading.value = false
    }
  }

  return {
    yearlyStats,
    monthlyStats,
    availableYears,
    loading,
    error,
    fetchYears,
    fetchYearlyStats,
    fetchMonthlyStats
  }
}
