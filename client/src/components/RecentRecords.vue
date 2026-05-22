<template>
  <div>
    <div v-if="loading" class="text-muted">加载中...</div>
    <div v-else-if="records.length === 0" class="text-muted">暂无记录</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>结果</th>
            <th>数量</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in records" :key="r.id">
            <td>{{ formatTime(r.created_at) }}</td>
            <td>
              <span v-for="(s, i) in r.stars" :key="i">
                <span :class="starClass(s)">{{ s }}★</span>
                <span v-if="i < r.stars.length - 1">, </span>
              </span>
            </td>
            <td>{{ r.count }}</td>
            <td>
              <button class="btn btn-danger btn-sm" @click="$emit('delete', r.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
defineProps({
  records: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})
defineEmits(['delete'])

function formatTime(t) {
  if (!t) return ''
  return t.replace('T', ' ').slice(0, 19)
}

function starClass(s) {
  return `star-${s}`
}
</script>
