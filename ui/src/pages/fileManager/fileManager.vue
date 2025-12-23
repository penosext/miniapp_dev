<template>
  <div>
    <div v-for="file in files" :key="file.fullPath" class="file-item">
      <span>{{ file.icon }}</span>
      <span @dblclick="openItem(file)">{{ file.name }}</span>
      <button @click="renameItem(file)">重命名</button>
      <button @click="deleteItem(file)">删除</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import type { FileItem, FileManagerOptions } from './types';
import * as service from './fileManagerService';
import { getFileIcon } from './fileTypes';
import { openSoftKeyboard } from './utils';
import { showLoading, hideLoading, showError, showSuccess, showInfo } from '../../components/ToastMessage';

export default defineComponent({
  props: {
    options: Object as () => FileManagerOptions
  },
  setup(props) {
    const currentPath = ref(props.options?.path || '/');
    const files = ref<FileItem[]>([]);

    async function load() {
      try {
        showLoading();
        const list = await service.loadDirectory(currentPath.value);
        files.value = list.map(f => ({ ...f, icon: getFileIcon(f) }));
      } catch (e: any) {
        showError(`加载失败: ${e.message}`);
      } finally {
        hideLoading();
      }
    }

    async function openItem(file: FileItem) {
      if (file.type==='directory') { currentPath.value = file.fullPath; await load(); return; }
      showInfo(`打开文件: ${file.name}`);
    }

    async function deleteItem(file: FileItem) {
      if (!confirm(`确定删除 ${file.name} 吗？`)) return;
      try { showLoading(); await service.deleteItem(file); showSuccess('删除成功'); await load(); }
      catch(e: any){ showError(`删除失败: ${e.message}`); }
      finally{ hideLoading(); }
    }

    async function renameItem(file: FileItem) {
      openSoftKeyboard(() => file.name, async (newName) => {
        if (!newName.trim() || newName===file.name) { showInfo('未修改'); return; }
        try { showLoading(); await service.renameItem(file, newName, currentPath.value); showSuccess('重命名成功'); await load(); }
        catch(e: any){ showError(`重命名失败: ${e.message}`); }
        finally{ hideLoading(); }
      });
    }

    onMounted(async () => { await service.initializeShell(); await load(); });

    return { files, openItem, deleteItem, renameItem };
  }
});
</script>

<style scoped>
.file-item { display:flex; gap:8px; margin:4px 0; }
button { cursor:pointer; }
</style>
