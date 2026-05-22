<template>
  <div class="csv-import">
    <!-- Step 1: File selection -->
    <div class="csv-step">
      <input
        ref="fileInput"
        type="file"
        accept=".csv,text/csv"
        style="display:none"
        @change="handleFile"
      />
      <button class="btn btn-sm btn-default" @click="$refs.fileInput.click()">
        选择 CSV 文件
      </button>
      <span v-if="fileName" class="csv-filename">{{ fileName }}</span>
    </div>

    <!-- Step 2: Column mapping (shown after file is parsed) -->
    <div v-if="headers.length > 0" class="csv-step">
      <h4 class="csv-subtitle">列映射</h4>
      <div class="csv-mapping">
        <div class="csv-field">
          <label>年份列</label>
          <select v-model="colMap.year" class="select csv-select">
            <option :value="null">-- 请选择 --</option>
            <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>
        <div class="csv-field">
          <label>月份列</label>
          <select v-model="colMap.month" class="select csv-select">
            <option :value="null">-- 请选择 --</option>
            <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>
        <div class="csv-field">
          <label>日期列</label>
          <select v-model="colMap.day" class="select csv-select">
            <option :value="null">-- 请选择 --</option>
            <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>
        <div class="csv-field">
          <label>星级列</label>
          <select v-model="colMap.star" class="select csv-select">
            <option :value="null">-- 请选择 --</option>
            <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Step 3: Preview -->
    <div v-if="previewRows.length > 0" class="csv-step">
      <h4 class="csv-subtitle">预览（前 {{ previewRows.length }} 行）</h4>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>年份</th>
              <th>月份</th>
              <th>日期</th>
              <th>星级</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in previewRows" :key="i">
              <td>{{ row.year }}</td>
              <td>{{ row.month }}</td>
              <td>{{ row.day }}</td>
              <td>{{ row.star }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Step 4: Import -->
    <div v-if="validRows.length > 0" class="csv-step">
      <button
        class="btn btn-primary"
        :disabled="importing"
        @click="doImport"
      >
        {{ importing ? `导入中... (${imported}/${validRows.length})` : `导入 ${validRows.length} 条记录` }}
      </button>
      <p v-if="importResult" class="form-success">{{ importResult }}</p>
      <p v-if="importError" class="form-error">{{ importError }}</p>
    </div>

    <!-- Warnings -->
    <div v-if="skippedRows > 0" class="csv-step">
      <p class="csv-warn">已跳过 {{ skippedRows }} 行无效数据（星级非 3-6 或日期不合法）</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '../utils/api.js'

const emit = defineEmits(['imported'])

const fileInput = ref(null)
const fileName = ref('')
const headers = ref([])
const allRows = ref([])

const colMap = ref({
  year: null,
  month: null,
  day: null,
  star: null
})

const importing = ref(false)
const imported = ref(0)
const importResult = ref('')
const importError = ref('')
const skippedRows = ref(0)

// Preview first 5 rows after mapping
const previewRows = computed(() => {
  return validRows.value.slice(0, 5)
})

// All valid rows after mapping
const validRows = computed(() => {
  const result = []
  for (const row of allRows.value) {
    const y = colMap.value.year != null ? row[colMap.value.year]?.trim() : ''
    const m = colMap.value.month != null ? row[colMap.value.month]?.trim() : ''
    const d = colMap.value.day != null ? row[colMap.value.day]?.trim() : ''
    const s = colMap.value.star != null ? row[colMap.value.star]?.trim() : ''

    if (!y || !m || !d || !s) continue

    const year = parseInt(y)
    const month = parseInt(m)
    const day = parseInt(d)
    const star = parseInt(s)

    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(star)) continue
    if (month < 1 || month > 12 || day < 1 || day > 31) continue
    if (![3, 4, 5, 6].includes(star)) continue

    result.push({
      year,
      month,
      day,
      star,
      created_at: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    })
  }
  skippedRows.value = allRows.value.length - result.length
  return result
})

// Auto-match columns by header keywords
function autoMatch(headers) {
  const map = { year: null, month: null, day: null, star: null }
  headers.forEach((h, i) => {
    const lower = h.toLowerCase()
    if (map.year == null && /年|year/.test(lower)) map.year = i
    if (map.month == null && /月|month/.test(lower)) map.month = i
    if (map.day == null && /日|day/.test(lower)) map.day = i
    if (map.star == null && /星|star/.test(lower)) map.star = i
  })
  colMap.value = map
}

// Parse CSV text
function parseCSV(text) {
  const lines = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        current += '\t'
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        lines.push(current.split('\t'))
        current = ''
        if (ch === '\r') i++
      } else if (ch === '\r') {
        lines.push(current.split('\t'))
        current = ''
      } else {
        current += ch
      }
    }
  }
  if (current) {
    lines.push(current.split('\t'))
  }

  return lines.filter(line => line.length > 1 || (line.length === 1 && line[0] !== ''))
}

function handleFile(e) {
  const file = e.target.files[0]
  if (!file) return

  fileName.value = file.name
  importResult.value = ''
  importError.value = ''

  const reader = new FileReader()
  reader.onload = (ev) => {
    const text = ev.target.result
    const parsed = parseCSV(text)
    if (parsed.length < 2) {
      importError.value = 'CSV 文件为空或格式不正确'
      return
    }

    headers.value = parsed[0].map(h => h.trim())
    allRows.value = parsed.slice(1)
    autoMatch(headers.value)
  }
  reader.readAsText(file, 'UTF-8')
}

async function doImport() {
  importing.value = true
  imported.value = 0
  importResult.value = ''
  importError.value = ''

  const rows = validRows.value.map(row => ({
    stars: [row.star],
    created_at: row.created_at
  }))

  try {
    const res = await api('/api/records/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows })
    })
    const data = await res.json()
    if (res.ok) {
      imported.value = data.imported
      importResult.value = `成功导入 ${data.imported} 条记录`
    } else {
      importError.value = data.error || '导入失败'
    }
  } catch {
    importError.value = '网络错误，导入失败'
  }

  importing.value = false
  emit('imported')
}

// Reset file input when component remounts
watch(() => fileInput.value, () => {
  if (fileInput.value) fileInput.value.value = ''
})
</script>

<style scoped>
.csv-import {
  margin-top: 12px;
}
.csv-step {
  margin-bottom: 12px;
}
.csv-filename {
  margin-left: 8px;
  font-size: 13px;
  color: #666;
}
.csv-subtitle {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}
.csv-mapping {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.csv-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.csv-field label {
  font-size: 13px;
  color: #555;
}
.csv-select {
  min-width: 120px;
}
.csv-warn {
  font-size: 13px;
  color: #e6a23c;
}
.form-success {
  color: #67c23a;
  font-size: 13px;
  margin-top: 6px;
}
.form-error {
  color: #f56c6c;
  font-size: 13px;
  margin-top: 6px;
}
</style>
