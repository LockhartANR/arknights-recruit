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
  year: { type: [String, Number], required: true },
  // 有值表示月度视图
  monthLabel: { type: [String, Number], default: null },
  // 月度：从 /stats?year&month 现算的汇总
  // 全年：/stats/trend 的 summary
  stats: { type: Object, default: null },
  // 月度对比基线（全年的「有记录月份」月均），也可能为 null
  yearAvgPerActiveMonth: { type: Number, default: null }
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

// 月度与年度的关注点完全不同，因此分两套。
//
// 月度不能用「有记录月份 / 月均 / 最多最少的月份」这类指标 ——
// 只有一个月的范围内它们是恒定的废话（「有记录月份 1 个月」）。
// 月度该回答的是：这个月打了多少、花在几天、平均每天多少、最常出几星，
// 以及和全年平均水平相比是高是低。
function monthlyCards(s) {
  const out = []

  out.push({ label: '总次数', value: s.yearTotal, tone: 'accent' })

  if (s.totalDays) {
    out.push({ label: '记录天数', value: `${s.totalDays} 天`, tone: '' })

    if (s.totalDays > 0) {
      const perDay = Math.round((s.yearTotal / s.totalDays) * 10) / 10
      out.push({ label: '日均', value: perDay, hint: '总次数 ÷ 记录天数', tone: '' })
    }
  }

  // 与全年「有记录的月份」相比。用有记录月份的均值而不是除以 12，
  // 否则基线会被空月份拉低，比较结果没有意义。
  const base = props.yearAvgPerActiveMonth
  if (base) {
    out.push({
      label: `${props.year} 年月均`,
      value: base,
      hint: '仅有记录的月份',
      tone: ''
    })

    const diff = s.yearTotal - base
    const pct = Math.round((diff / base) * 100)
    out.push({
      label: '与月均相比',
      value: `${pct >= 0 ? '+' : ''}${pct}%`,
      hint: `${diff >= 0 ? '多' : '少'} ${Math.abs(Math.round(diff * 10) / 10)} 次`,
      tone: pct >= 0 ? 'up' : 'down'
    })
  }

  // 星级用「平均星级 + 4★以上占比」两项，而不是「最常出」。
  // 原因：3★ 长期占 72%~76%，「最常出」永远显示 3★，等于没有信息量。
  // 实测各月平均星级的极差只有 0.11（3.22~3.33），所以再配一个
  // 真正有波动幅度的指标：4★ 以上占比（各月 21.6%~31.5%）。
  if (s.avgStar != null) {
    out.push({ label: '平均星级', value: s.avgStar, hint: '按次数加权', tone: '' })
  }

  if (s.fourPlusPct != null) {
    out.push({
      label: '4★以上',
      value: `${s.fourPlusPct}%`,
      hint: `${s.fourPlusCount} 次`,
      tone: ''
    })
  }

  return out
}

// 年度：一张卡回答一个问题 —— 打了多少、覆盖几个月、月均、最高/最低月、最常出几星、花了多少天
function yearlyCards(s) {
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

  // 只有一个有记录的月份时最高与最低是同一个，再列一次没有意义
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
}

const cards = computed(() => {
  const s = props.stats
  if (!s) return []
  return props.monthLabel ? monthlyCards(s) : yearlyCards(s)
})
</script>
