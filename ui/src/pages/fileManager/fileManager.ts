// Copyright (C) 2025 Langning Chen
// This file is part of miniapp.
// miniapp is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// miniapp is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
// You should have received a copy of the GNU General Public License
// along with miniapp. If not, see <https://www.gnu.org/licenses/>.

import { defineComponent } from 'vue';
import { Shell } from 'langningchen';
import { showError, showSuccess, showWarning, showInfo } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils';
import { formatTime } from '../../utils/timeUtils';

export type FileManagerOptions = {
  path?: string;
  refresh?: boolean;
};

export interface FileItem {
  name: string;
  type: 'file' | 'directory' | 'link' | 'unknown';
  size: number;
  sizeFormatted: string;
  modifiedTime: number;
  modifiedTimeFormatted: string;
  permissions: string;
  isHidden: boolean;
  fullPath: string;
  icon: string;
  isExecutable: boolean;
}

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<FileManagerOptions>,

      currentPath: '/',
      fileList: [] as FileItem[],
      shellInitialized: false,
      isLoading: false,

      showContextMenu: false,
      contextMenuX: 0,
      contextMenuY: 0,
      selectedFile: null as FileItem | null,
      showConfirmModal: false,
      confirmTitle: '',
      confirmMessage: '',
      confirmCallback: null as (() => void) | null,

      searchKeyword: '',
      showHiddenFiles: false,

      totalFiles: 0,
      totalSize: 0,
      selectedCount: 0,
    };
  },

  async mounted() {
    const options = this.$page.loadOptions;
    this.currentPath = options.path || '/';
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on("backpressed", this.handleBackPress);
    $falcon.on('file_saved', this.handleFileSaved);
    await this.initializeShell();
  },

  beforeDestroy() {
    this.$page.$npage.off("backpressed", this.handleBackPress);
    $falcon.off('file_saved', this.handleFileSaved);
  },

  computed: {
    filteredFiles(): FileItem[] {
      let files = [...this.fileList];
      if (!this.showHiddenFiles) files = files.filter(f => !f.isHidden);
      if (this.searchKeyword) {
        const keyword = this.searchKeyword.toLowerCase();
        files = files.filter(f => f.name.toLowerCase().includes(keyword));
      }
      files.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      return files;
    },

    canGoBack(): boolean {
      return this.currentPath !== '/';
    },

    parentPath(): string {
      if (this.currentPath === '/') return '/';
      const parts = this.currentPath.split('/').filter(p => p);
      parts.pop();
      return parts.length > 0 ? '/' + parts.join('/') : '/';
    },
  },

  methods: {
    async initializeShell() {
      try {
        if (!Shell) throw new Error('Shell对象未定义');
        if (typeof Shell.initialize !== 'function') throw new Error('Shell.initialize方法不存在');
        await Shell.initialize();
        this.shellInitialized = true;
        await this.loadDirectory();
      } catch (error: any) {
        showError(`Shell初始化失败: ${error.message}`);
        this.shellInitialized = false;
      }
    },

    async loadDirectory() {
      if (!this.shellInitialized || !Shell) return;

      try {
        this.isLoading = true;
        showLoading();

        let path = this.currentPath;
        if (!path.startsWith('/')) path = '/' + path;
        if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
        this.currentPath = path;

        const listCmd = `cd "${path}" && ls -la --time-style=+%s 2>/dev/null || ls -la 2>/dev/null`;
        let result = '';
        try { result = await Shell.exec(listCmd); } catch { result = await Shell.exec(`cd "${path}" && ls -la`); }

        if (!result || result.trim() === '') {
          this.fileList = [];
          return;
        }

        const lines = result.trim().split('\n').slice(1);
        const files: FileItem[] = [];

        for (const line of lines) {
          const file = this.parseFileLine(line);
          if (file) files.push(file);
        }

        this.fileList = files;
        this.updateStats();
      } catch (error: any) {
        showError(`加载目录失败: ${error.message}`);
        this.fileList = [];
        if (this.currentPath !== '/') {
          this.currentPath = '/';
          await this.loadDirectory();
        }
      } finally {
        this.isLoading = false;
        hideLoading();
      }
    },

    parseFileLine(line: string): FileItem | null {
      if (!line.trim()) return null;

      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;

      const permissions = parts[0];
      let name = parts[parts.length - 1];
      if (name === '.' || name === '..') return null;

      let type: 'file' | 'directory' | 'link' | 'unknown' = 'unknown';
      let icon = '?';

      const typeChar = permissions.charAt(0);
      const isExecutable = permissions.includes('x');
      const isHidden = name.startsWith('.');

      if (typeChar === 'd') { type = 'directory'; icon = 'Dir'; }
      else if (typeChar === 'l') { type = 'link'; icon = 'lin'; }
      else { 
        type = 'file'; 
        if (name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|bash|cfg)$/i)) icon = '文';
        else if (name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) icon = '图';
        else if (name.match(/\.(amr|apk|bin|so|exe)$/i)) icon = '执';
        else icon = '文';
      }

      let size = 0;
      for (let i = 1; i < parts.length - 1; i++) {
        const num = parseInt(parts[i], 10);
        if (!isNaN(num) && num >= 0 && num < 1e12) { size = num; break; }
      }

      let sizeFormatted = type === 'directory' ? '<DIR>' :
                          size < 1024 ? `${size} B` :
                          size < 1024*1024 ? `${(size/1024).toFixed(1)} KB` :
                          size < 1024*1024*1024 ? `${(size/(1024*1024)).toFixed(1)} MB` :
                          `${(size/(1024*1024*1024)).toFixed(1)} GB`;

      const fullPath = this.currentPath === '/' ? `/${name}` : `${this.currentPath}/${name}`;
      const modifiedTime = Math.floor(Date.now()/1000);

      return {
        name,  // link 文件显示自身文件名
        type,
        size,
        sizeFormatted,
        modifiedTime,
        modifiedTimeFormatted: formatTime(modifiedTime),
        permissions,
        isHidden,
        fullPath,
        icon,
        isExecutable,
      };
    },

    updateStats() {
      this.totalFiles = this.fileList.length;
      this.totalSize = this.fileList.filter(f => f.type==='file').reduce((sum,f)=>sum+f.size,0);
      this.selectedCount = 0;
    },

    async openItem(item: FileItem) {
      if (item.type === 'directory') {
        this.currentPath = item.fullPath;
        await this.loadDirectory();
      } else {
        await this.openFile(item);
      }
    },

    async openFile(file: FileItem) {
      try {
        const checkCmd = `test -f "${file.fullPath}" && echo "exists" || echo "not exists"`;
        const exists = (await Shell.exec(checkCmd)).trim();
        if (exists !== 'exists') { showError(`文件不存在: ${file.fullPath}`); return; }

        const ext = file.name.split('.').pop() || '';
        const editable = file.name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|bash|cfg)$/i)
                          || (!file.name.includes('.') && file.isExecutable)
                          || ['link','cfg','sh'].includes(ext);

        if (editable) {
          $falcon.navTo('fileEditor', { filePath: file.fullPath, returnTo:'fileManager', returnPath:this.currentPath });
        } else showInfo(`打开文件: ${file.name} (暂不支持预览)`);
      } catch (error: any) { showError(`打开文件失败: ${error.message}`); }
    },

    async deleteItem(item: FileItem) {
      this.showConfirmModal = true;
      this.confirmTitle = '确认删除';
      this.confirmMessage = `确定删除 ${item.name} 吗？此操作不可恢复！`;
      this.confirmCallback = async () => {
        try {
          showLoading();
          await Shell.exec(`rm -rf "${item.fullPath.replace(/"/g,'\\"')}"`);
          showSuccess(`删除成功: ${item.name}`);
          await this.loadDirectory();
        } catch (e:any) { showError(`删除失败: ${e.message}`); }
        finally { hideLoading(); this.showConfirmModal = false; }
      };
    },

    async renameItem(item: FileItem) {
      openSoftKeyboard(
        () => item.name,
        async (newName) => {
          if (!newName.trim() || newName === item.name) { if(newName===item.name) showInfo('文件名未改变'); return; }
          try {
            showLoading();
            const newPath = this.currentPath === '/' ? `/${newName}` : `${this.currentPath}/${newName}`;
            await Shell.exec(`mv "${item.fullPath.replace(/"/g,'\\"')}" "${newPath.replace(/"/g,'\\"')}"`);
            showSuccess(`重命名成功: ${item.name} -> ${newName}`);
            await this.loadDirectory();
          } catch(e:any){ showError(`重命名失败: ${e.message}`); }
          finally{ hideLoading(); }
        },
        (value) => {
          if(!value.trim()) return '请输入新名称';
          if(value.includes('/')) return '名称不能包含斜杠';
          if(value===item.name) return '新名称不能与原名相同';
          return undefined;
        }
      );
    },

    copyFilePath(item: FileItem) { showInfo(`文件路径: ${item.fullPath}`); },

    showContextMenu(event: any, item: FileItem) {
      this.selectedFile = item;
      this.contextMenuX = event.x || 100;
      this.contextMenuY = event.y || 100;
      this.showContextMenu = true;
      setTimeout(()=>{
        const handler=()=>{ this.showContextMenu=false; document.removeEventListener('click',handler); };
        document.addEventListener('click',handler);
      },100);
    },

    async executeContextMenu(action: string) {
      if(!this.selectedFile) return;
      this.showContextMenu=false;
      switch(action){
        case 'open': await this.openItem(this.selectedFile); break;
        case 'rename': await this.renameItem(this.selectedFile); break;
        case 'delete': await this.deleteItem(this.selectedFile); break;
        case 'copy_path': this.copyFilePath(this.selectedFile); break;
        case 'properties': this.showFileProperties(this.selectedFile); break;
      }
      this.selectedFile=null;
    },

    showFileProperties(item: FileItem) {
      const properties = `
文件名称: ${item.name}
文件类型: ${item.type==='directory'?'目录':'文件'}
文件大小: ${item.sizeFormatted}
修改时间: ${item.modifiedTimeFormatted}
权限设置: ${item.permissions}
完整路径: ${item.fullPath}
隐藏文件: ${item.isHidden?'是':'否'}
可执行文件: ${item.isExecutable?'是':'否'}
      `.trim();
      showInfo(properties);
    },

    toggleHiddenFiles(){ this.showHiddenFiles=!this.showHiddenFiles; this.$forceUpdate(); },
    searchFiles(){ openSoftKeyboard(()=>this.searchKeyword, (v)=>{ this.searchKeyword=v; this.$forceUpdate(); }); },
    clearSearch(){ this.searchKeyword=''; this.$forceUpdate(); },
    formatSize(bytes:number){ return bytes<1024?`${bytes} B`:
      bytes<1024*1024?`${(bytes/1024).toFixed(1)} KB`:
      bytes<1024*1024*1024?`${(bytes/(1024*1024)).toFixed(1)} MB`:
      `${(bytes/(1024*1024*1024)).toFixed(1)} GB`; },

    getFileIconClass(file: FileItem): string {
      let base='file-icon';
      if(file.type==='directory') return `${base} file-icon-folder`;
      if(file.type==='link') return `${base} file-icon-link`;
      const name=file.name.toLowerCase();
      if(name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) return `${base} file-icon-image`;
      if(name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|cfg)$/i)) return `${base} file-icon-text`;
      if(file.isExecutable||name.match(/\.(sh|bash|amr|apk|bin|so)$/i)) return `${base} file-icon-executable`;
      return `${base} file-icon-file`;
    },

    handleFileSaved(e:{data:string}){ this.loadDirectory(); },

    handleBackPress() {
      if(this.showContextMenu||this.showConfirmModal){ this.showContextMenu=false; this.showConfirmModal=false; return; }
      if(this.canGoBack) { this.goBack(); return; }
      this.$page.finish();
    },

    executeConfirmAction(){ if(this.confirmCallback)this.confirmCallback(); this.showConfirmModal=false; this.confirmCallback=null; },
    cancelConfirmAction(){ this.showConfirmModal=false; this.confirmCallback=null; },

    async goBack(){ if(!this.canGoBack) return; this.currentPath=this.parentPath; await this.loadDirectory(); },
    async refreshDirectory(){ await this.loadDirectory(); showSuccess('目录已刷新'); },

    async createNewFile() {
      openSoftKeyboard(()=>'', async (fileName)=>{
        if(!fileName.trim()){ showWarning('文件名不能为空'); return; }
        try{
          showLoading();
          const fullPath=this.currentPath==='/'?`/${fileName}`:`${this.currentPath}/${fileName}`;
          await Shell.exec(`touch "${fullPath.replace(/"/g,'\\"')}"`);
          showSuccess(`文件创建成功: ${fileName}`);
          await this.loadDirectory();
        } catch(e:any){ showError(`创建文件失败: ${e.message}`); } finally{ hideLoading(); }
      }, (value)=>{ if(!value.trim()) return '请输入文件名'; if(value.includes('/')) return '文件名不能包含斜杠'; return undefined; });
    },

    async createNewDirectory() {
      openSoftKeyboard(()=>'', async (dirName)=>{
        if(!dirName.trim()){ showWarning('目录名不能为空'); return; }
        try{
          showLoading();
          const fullPath=this.currentPath==='/'?`/${dirName}`:`${this.currentPath}/${dirName}`;
          await Shell.exec(`mkdir -p "${fullPath.replace(/"/g,'\\"')}"`);
          showSuccess(`目录创建成功: ${dirName}`);
          await this.loadDirectory();
        } catch(e:any){ showError(`创建目录失败: ${e.message}`); } finally{ hideLoading(); }
      }, (value)=>{ if(!value.trim()) return '请输入目录名'; if(value.includes('/')) return '目录名不能包含斜杠'; return undefined; });
    }
});
