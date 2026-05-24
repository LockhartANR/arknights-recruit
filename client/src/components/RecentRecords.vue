<template>
  <div>
    <div v-if="loading" class="text-muted">加载中...</div>
    <div v-else-if="records.length === 0" class="text-muted">暂无记录</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>星级</th>
            <th>干员</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in records" :key="r.id">
            <td>{{ formatTime(r.created_at) }}</td>
            <td><span :class="'star-' + r.stars">{{ r.stars }}★</span></td>
            <td>
              <OperatorSelector
                :model-value="r.operator_id"
                :rarity="r.stars"
                @update:model-value="(opId) => $emit('update-operator', r.id, opId)"
              />
            </td>
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
import OperatorSelector from './OperatorSelector.vue'

defineProps({
  records: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})
defineEmits(['delete', 'update-operator'])

function formatTime(t) {
  if (!t) return ''
  return t.replace('T', ' ').slice(0, 19)
}

function onImgError(e) {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.op-avatar {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  vertical-align: middle;
  margin-right: 4px;
  background: #f0f0f0;
}

.text-muted-inline {
  color: #bbb;
  font-size: 12px;
}
</style>
