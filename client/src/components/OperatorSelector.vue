<template>
  <div class="operator-selector">
    <button
      type="button"
      class="selector-trigger"
      :class="{ placeholder: !selected }"
      @click="open = !open"
    >
      <template v-if="selected">
        <img :src="selected.avatar" class="trigger-avatar" @error="onImgError" />
        <span class="trigger-name">{{ selected.name }}</span>
        <span :class="'star-' + selected.rarity" class="trigger-rarity">{{ selected.rarity }}★</span>
      </template>
      <template v-else>
        <span class="trigger-placeholder">选择干员（可选）</span>
      </template>
      <span class="trigger-arrow">▾</span>
    </button>

    <div v-if="open" class="selector-dropdown">
      <div class="dropdown-search">
        <input
          v-model="search"
          class="form-input"
          placeholder="搜索干员..."
          @keydown.escape="open = false"
        />
      </div>
      <button
        type="button"
        class="dropdown-clear"
        @click="select(null)"
      >不指定干员</button>
      <div class="dropdown-list">
        <button
          v-for="op in filtered"
          :key="op.id"
          type="button"
          class="dropdown-item"
          :class="{ active: modelValue === op.id }"
          @click="select(op.id)"
        >
          <img :src="op.avatar" class="item-avatar" @error="onImgError" />
          <span class="item-name">{{ op.name }}</span>
          <span :class="'star-' + op.rarity" class="item-rarity">{{ op.rarity }}★</span>
          <span class="item-class">{{ op.class }}</span>
        </button>
        <div v-if="filtered.length === 0" class="dropdown-empty">无匹配干员</div>
      </div>
    </div>

    <button
      v-if="clearable && modelValue"
      type="button"
      class="selector-clear"
      @click="select(null)"
      title="清除"
    >&times;</button>

    <div v-if="open" class="selector-backdrop" @click="open = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useOperators } from '../composables/useOperators.js'

const props = defineProps({
  modelValue: { type: String, default: null },
  clearable: { type: Boolean, default: false },
  rarity: { type: Number, default: null }
})

const emit = defineEmits(['update:modelValue'])

const { fetchOperators, getOperator, getOperators } = useOperators()

const operators = ref([])
const open = ref(false)
const search = ref('')

const selected = computed(() => getOperator(props.modelValue))

const filtered = computed(() => {
  let list = operators.value
  if (props.rarity != null) {
    const r = Number(props.rarity)
    list = list.filter(op => Number(op.rarity) === r)
  }
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(op => op.name.toLowerCase().includes(q))
  }
  return list
})

function select(id) {
  emit('update:modelValue', id)
  open.value = false
  search.value = ''
}

function onImgError(e) {
  e.target.style.display = 'none'
}

watch(open, async (val) => {
  if (val && operators.value.length === 0) {
    operators.value = await fetchOperators()
  }
})
</script>

<style scoped>
.operator-selector {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.selector-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  color: #999;
  font-size: 16px;
  cursor: pointer;
  border-radius: 50%;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
}

.selector-clear:hover {
  color: #333;
  background: #f0f0f0;
}

.selector-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  min-width: 160px;
  max-width: 100%;
}

.selector-trigger:hover {
  border-color: #409EFF;
}

.selector-trigger.placeholder {
  color: #bbb;
}

.trigger-avatar {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #f0f0f0;
}

.trigger-name {
  color: #333;
}

.trigger-rarity {
  font-size: 11px;
}

.trigger-placeholder {
  color: #bbb;
}

.trigger-arrow {
  margin-left: auto;
  font-size: 10px;
  color: #999;
}

.selector-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
}

.selector-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  width: 280px;
  max-width: calc(100vw - 32px);
  max-height: 360px;
  display: flex;
  flex-direction: column;
}

.dropdown-search {
  padding: 8px;
}

.dropdown-search .form-input {
  padding: 6px 10px;
  font-size: 13px;
}

.dropdown-clear {
  display: block;
  width: 100%;
  text-align: center;
  padding: 6px;
  border: none;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}

.dropdown-clear:hover {
  background: #f0f0f0;
}

.dropdown-list {
  overflow-y: auto;
  flex: 1;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  text-align: left;
}

.dropdown-item:hover {
  background: #f5f7fa;
}

.dropdown-item.active {
  background: #ecf5ff;
}

.item-avatar {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: #f0f0f0;
  flex-shrink: 0;
}

.item-name {
  color: #333;
  flex: 1;
}

.item-rarity {
  font-size: 11px;
}

.item-class {
  font-size: 11px;
  color: #888;
}

.dropdown-empty {
  text-align: center;
  padding: 16px;
  color: #999;
  font-size: 13px;
}

@media (max-width: 640px) {
  .selector-trigger {
    min-width: 0;
  }
  .selector-dropdown {
    left: auto;
    right: 0;
  }
}
</style>
