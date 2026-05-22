<template>
  <div class="records-page">
    <div class="card">
      <div class="flex-between mb-8">
        <h2 class="card-title" style="margin-bottom:0">
          记录管理（共 {{ total }} 条）
        </h2>
        <button
          v-if="total > 0"
          class="btn btn-danger btn-sm"
          @click="confirmDeleteAll"
        >删除全部</button>
      </div>

      <!-- Table -->
      <div v-if="loading" class="text-muted">加载中...</div>
      <div v-else-if="records.length === 0" class="text-muted">暂无记录</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:36px">
                <input
                  type="checkbox"
                  :checked="allChecked"
                  @change="toggleAll"
                />
              </th>
              <th>日期</th>
              <th>星级</th>
              <th>干员</th>
              <th style="width:120px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in records" :key="r.id" :class="{ 'row-editing': editing?.id === r.id }">
              <td>
                <input
                  type="checkbox"
                  :checked="selected.has(r.id)"
                  @change="toggleOne(r.id)"
                />
              </td>
              <td>
                <template v-if="editing?.id === r.id">
                  <input
                    type="date"
                    v-model="editing.date"
                    class="form-input"
                    style="width:140px;padding:4px 8px"
                  />
                </template>
                <template v-else>{{ fmtDate(r.created_at) }}</template>
              </td>
              <td>
                <template v-if="editing?.id === r.id">
                  <select v-model="editing.stars" class="select" style="width:80px">
                    <option v-for="s in [3,4,5,6]" :key="s" :value="s">{{ s }}★</option>
                  </select>
                </template>
                <template v-else>
                  <span :class="'star-' + r.stars">{{ r.stars }}★</span>
                </template>
              </td>
              <td>
                <template v-if="editing?.id === r.id">
                  <OperatorSelector v-model="editing.operator_id" />
                </template>
                <template v-else>
                  <template v-if="r.operator_id && getOperator(r.operator_id)">
                    <img
                      :src="getOperator(r.operator_id).avatar"
                      class="op-avatar"
                      @error="onImgError"
                    />
                    {{ getOperator(r.operator_id).name }}
                  </template>
                  <span v-else class="text-muted-inline">(未指定)</span>
                </template>
              </td>
              <td>
                <template v-if="editing?.id === r.id">
                  <button class="btn btn-sm btn-primary" @click="saveEdit(r.id)">保存</button>
                  <button class="btn btn-sm btn-default" @click="cancelEdit" style="margin-left:4px">取消</button>
                </template>
                <template v-else>
                  <button class="btn btn-sm btn-default" @click="startEdit(r)">编辑</button>
                  <button class="btn btn-sm btn-danger" @click="deleteOne(r.id)" style="margin-left:4px">删除</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Batch actions -->
      <div v-if="selected.size > 0" class="batch-bar">
        已选 {{ selected.size }} 条
        <button class="btn btn-sm btn-danger" @click="deleteSelected">删除选中</button>
        <button class="btn btn-sm btn-default" @click="clearSelection">取消选择</button>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="btn btn-sm btn-default" :disabled="page === 0" @click="goPage(page - 1)">上一页</button>
        <span class="page-info">{{ page + 1 }} / {{ totalPages }}</span>
        <button class="btn btn-sm btn-default" :disabled="page >= totalPages - 1" @click="goPage(page + 1)">下一页</button>
      </div>
    </div>

    <!-- Delete all confirm dialog -->
    <div v-if="showDeleteAllConfirm" class="modal-overlay" @click.self="showDeleteAllConfirm = false">
      <div class="modal-box">
        <p>确定要删除 <strong>全部 {{ total }} 条</strong> 记录吗？此操作不可撤销。</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-sm btn-default" @click="showDeleteAllConfirm = false">取消</button>
          <button class="btn btn-sm btn-danger" @click="deleteAll">确认删除全部</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useOperators } from '../composables/useOperators.js'
import OperatorSelector from '../components/OperatorSelector.vue'

const { fetchOperators, getOperator } = useOperators()

const records = ref([])
const total = ref(0)
const page = ref(0)
const pageSize = 50
const loading = ref(false)
const editing = ref(null)
const selected = ref(new Set())
const showDeleteAllConfirm = ref(false)

const totalPages = computed(() => Math.ceil(total.value / pageSize))
const allChecked = computed(() =>
  records.value.length > 0 && records.value.every(r => selected.value.has(r.id))
)

async function fetchRecords() {
  loading.value = true
  try {
    const offset = page.value * pageSize
    const res = await api(`/api/records?offset=${offset}&limit=${pageSize}`)
    const data = await res.json()
    records.value = data.records
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function goPage(p) {
  page.value = p
  selected.value = new Set()
  editing.value = null
  fetchRecords()
}

function fmtDate(t) {
  if (!t) return ''
  return t.slice(0, 10)
}

// Selection
function toggleAll() {
  if (allChecked.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(records.value.map(r => r.id))
  }
}

function toggleOne(id) {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selected.value = s
}

function clearSelection() {
  selected.value = new Set()
}

// Edit
function startEdit(record) {
  editing.value = {
    id: record.id,
    stars: record.stars,
    operator_id: record.operator_id || null,
    date: (record.created_at || '').slice(0, 10)
  }
}

function cancelEdit() {
  editing.value = null
}

async function saveEdit(id) {
  const ed = editing.value
  if (!ed || ed.id !== id) return

  const body = { stars: ed.stars, created_at: ed.date }
  if (ed.operator_id !== undefined) {
    body.operator_id = ed.operator_id
  }

  try {
    await api(`/api/records/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    editing.value = null
    await fetchRecords()
  } catch {
    // Error stays in edit mode
  }
}

// Delete
async function deleteOne(id) {
  try {
    await api(`/api/records/${id}`, { method: 'DELETE' })
    selected.value = new Set()
    await fetchRecords()
  } catch { /* ignore */ }
}

async function deleteSelected() {
  const ids = [...selected.value]
  try {
    await api('/api/records/delete-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
    selected.value = new Set()
    // If page becomes empty (not first page), go back one page
    if (records.value.length === ids.length && page.value > 0) {
      page.value--
    }
    await fetchRecords()
  } catch { /* ignore */ }
}

function confirmDeleteAll() {
  showDeleteAllConfirm.value = true
}

async function deleteAll() {
  try {
    await api('/api/records/all', { method: 'DELETE' })
    showDeleteAllConfirm.value = false
    selected.value = new Set()
    page.value = 0
    await fetchRecords()
  } catch { /* ignore */ }
}

function onImgError(e) {
  e.target.style.display = 'none'
}

onMounted(() => {
  fetchOperators()
  fetchRecords()
})
</script>

<style scoped>
.records-page {
  /* uses global .card, .btn, .table styles */
}

.row-editing {
  background: #f0f7ff;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 8px 0;
  font-size: 13px;
  color: #555;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

.page-info {
  font-size: 13px;
  color: #888;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-box {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.modal-box p {
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}

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
