<template>
  <div class="card">
    <h2 class="card-title">{{ title }}</h2>
    <div class="summary-grid">
      <div v-for="c in cards" :key="c.label" class="summary-item">
        <div class="summary-label">{{ c.label }}</div>
        <div class="summary-value" :class="c.tone">{{ c.value }}</div>
        <div v-if="c.hint" class="summary-hint">{{ c.hint }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 起始月份数（1-12）与月份标签，仅用于文案
  year: { type: [String, Number], required: true },
  monthLabel: { type: [String, Number], default: null },
  stats: { type: Object, default: null }
})

const title = computed(() =>
  props.monthLabel ? `${props.year} 年 ${props.monthLabel} 月 概览` : `${props.year} 年 概览`
)

// 星级配色与饼图、表格保持一致，避免同一个星级在不同位置颜色不同
const STAR_COLORS = {
  1: '#C8CDD4',
  2: '#A9B2BE',
  3: '#909399',
  4: '#409EFF',
  5: '#E6A23C',
  6: '#F56C6C'
}

const cards = computed(() => {
  const s = props.stats
  if (!s) return []

  const out = [
    { label: '总次数', value: s.yearTotal, tone: 'accent' },
    { label: '有记录月份', value: `${s.activeMonths} 个月`, tone: '' }
  ]

  if (s.avgPerActiveMonth) {
    out.push({ label: '月均', value: s.avgPerActiveMonth, hint: '仅有记录的月份', tone: '' })
  }

  if (s.peak) {
    out.push({
      label: '最多',
      value: `${s.peak.month} 月`,
      hint: `${s.peak.total} 次`,
      tone: ''
    })
  }

  // 只有一个有记录的月份时，最高与最低是同一个，再列一次没有意义
  if (s.low && s.activeMonths > 1 && s.low.month !== s.peak?.month) {
    out.push({
      label: '最少',
      value: `${s.low.month} 月`,
      hint: `${s.low.total} 次`,
      tone: ''
    })
  }

  if (s.topStar) {
    out.push({
      label: '最常出',
      value: `${s.topStar}★`,
      hint: `${s.topStarCount} 次`,
      tone: `star-${s.topStar}`
    })
  }

  if (s.totalDays) {
    out.push({ label: '记录天数', value: `${s.totalDays} 天`, tone: '' })
  }

  return out
})
</script>
