<template>
  <div class="input-page">
    <div class="card">
      <h2 class="card-title">公招结果录入</h2>
      <div class="form-group">
        <label class="form-label">输入星级（逗号分隔，如：4,3,5,6,4,3）</label>
        <div class="flex-row">
          <input
            v-model="inputText"
            class="form-input"
            placeholder="请输入星级，用逗号分隔，例如：4,3,5,6,4,3"
            @keyup.enter="submit"
          />
          <button class="btn btn-primary" @click="submit">提交</button>
        </div>
        <p v-if="errorMsg" class="form-error">{{ errorMsg }}</p>
        <p v-if="successMsg" class="form-success">{{ successMsg }}</p>
      </div>
    </div>

    <div class="card">
      <div class="flex-between mb-8">
        <h2 class="card-title" style="margin-bottom:0">最近记录</h2>
        <div style="display:flex;gap:8px">
          <button
            class="btn btn-sm btn-default"
            @click="triggerImport"
          >导入数据</button>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            style="display:none"
            @change="handleImport"
          />
          <button
            class="btn btn-sm btn-default"
            @click="showCsvImport = !showCsvImport"
          >导入 CSV</button>
          <button
            v-if="records.length > 0"
            class="btn btn-sm btn-default"
            @click="exportData"
          >导出数据</button>
        </div>
      </div>
      <CsvImport
        v-if="showCsvImport"
        @imported="onCsvImported"
      />
      <RecentRecords
        :records="records"
        :loading="loading"
        @delete="deleteRecord"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import RecentRecords from '../components/RecentRecords.vue'
import CsvImport from '../components/CsvImport.vue'
import { api } from '../utils/api.js'

const inputText = ref('')
const errorMsg = ref('')
const successMsg = ref('')
const records = ref([])
const loading = ref(false)
const showCsvImport = ref(false)

function onCsvImported() {
  fetchRecords()
}

async function fetchRecords() {
  loading.value = true
  try {
    const res = await api('/api/records?limit=20')
    records.value = await res.json()
  } finally {
    loading.value = false
  }
}

function validate(input) {
  if (!input.trim()) return '输入不能为空'

  const parts = input.split(',').map(s => s.trim()).filter(s => s !== '')
  if (parts.length === 0) return '输入不能为空'

  const stars = parts.map(Number)
  if (stars.some(isNaN)) return '请输入有效的数字'
  if (stars.some(n => ![3, 4, 5, 6].includes(n))) return '星级只能是 3、4、5、6'
  if (stars.some(n => !Number.isInteger(n))) return '请输入整数'

  return null
}

async function submit() {
  errorMsg.value = ''
  successMsg.value = ''

  const err = validate(inputText.value)
  if (err) {
    errorMsg.value = err
    return
  }

  const parts = inputText.value.split(',').map(s => s.trim()).filter(s => s !== '')
  const stars = parts.map(Number)

  try {
    const res = await api('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stars })
    })
    if (!res.ok) {
      const data = await res.json()
      errorMsg.value = data.error || '提交失败'
      return
    }
    inputText.value = ''
    successMsg.value = `已录入 ${stars.length} 条记录`
    setTimeout(() => { successMsg.value = '' }, 2000)
    await fetchRecords()
  } catch {
    errorMsg.value = '网络错误，请确认服务器已启动'
  }
}

async function deleteRecord(id) {
  try {
    await api(`/api/records/${id}`, { method: 'DELETE' })
    await fetchRecords()
  } catch {
    errorMsg.value = '删除失败'
  }
}

const fileInput = ref(null)

function triggerImport() {
  fileInput.value.click()
}

async function handleImport(e) {
  const file = e.target.files[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data)) {
      errorMsg.value = '导入失败：文件格式不正确'
      return
    }

    let imported = 0
    for (const record of data) {
      if (!record.stars || !Array.isArray(record.stars)) continue
      const stars = record.stars
      const valid = stars.every(s => [3,4,5,6].includes(s))
      if (!valid || stars.length === 0) continue

      await api('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars })
      })
      imported++
    }

    successMsg.value = `已导入 ${imported} 条记录`
    setTimeout(() => { successMsg.value = '' }, 2000)
    await fetchRecords()
  } catch {
    errorMsg.value = '导入失败：无法解析文件'
  }

  // Reset the file input so the same file can be re-imported
  fileInput.value.value = ''
}

function exportData() {
  api('/api/records?limit=99999')
    .then(r => r.json())
    .then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arknights-recruit-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    })
}

onMounted(fetchRecords)
</script>

<style scoped>
.form-success {
  color: #67c23a;
  font-size: 13px;
  margin-top: 6px;
}
</style>
