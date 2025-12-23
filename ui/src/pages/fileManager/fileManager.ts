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
        const kw = this.searchKeyword.toLowerCase();
        files = files.filter(f => f.name.toLowerCase().includes(kw));
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
      if (parts.length === 0) return '/';
      parts.pop();
      return parts.length > 0 ? '/' + parts.join('/') : '/';
    },
  },

  methods: {
    async initializeShell() {
      try {
        await Shell.initialize();
        this.shellInitialized = true;
        await this.loadDirectory();
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        showError(`Shell初始化失败: ${error.message}`);
        this.shellInitialized = false;
      }
    },

    async loadDirectory() {
      if (!this.shellInitialized) { showError('Shell未初始化'); return; }
      try {
        this.isLoading = true;
        showLoading();
        let path = this.currentPath;
        if (!path.startsWith('/')) path = '/' + path;
        if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
        this.currentPath = path;

        const cmd = `cd "${path}" && ls -la --time-style=+%s 2>/dev/null || ls -la 2>/dev/null`;
        let result = '';
        try { result = await Shell.exec(cmd); } catch { result = await Shell.exec(`cd "${path}" && ls -la`); }

        if (!result || result.trim() === '') { this.fileList = []; return; }

        const lines = result.trim().split('\n').slice(1);
        const files: FileItem[] = [];

        for (const line of lines) {
          const file = this.parseFileLineSimple(line);
          if (file) files.push(file);
        }

        this.fileList = files;
        this.updateStats();
      } catch (error: any) {
        console.error('加载目录失败:', error);
        showError(`加载目录失败: ${error.message}`);
        this.fileList = [];
        if (this.currentPath !== '/') { this.currentPath = '/'; await this.loadDirectory(); }
      } finally {
        this.isLoading = false;
        hideLoading();
      }
    },

    parseFileLineSimple(line: string): FileItem | null {
      if (!line.trim()) return null;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;
      const permissions = parts[0];
      const name = parts[parts.length - 1];
      if (name === '.' || name === '..') return null;

      const typeChar = permissions.charAt(0);
      let type: 'file' | 'directory' | 'link' | 'unknown' = 'unknown';
      let icon = '?';

      if (typeChar === '-') {
        type = 'file';
        if (name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|cfg|log|conf|ini|yml|yaml)$/i)) icon = '文';
        else if (name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) icon = '图';
        else if (name.match(/\.(amr|apk|bin|so|exe)$/i)) icon = '执';
        else icon = '文';
      } else if (typeChar === 'd') { type = 'directory'; icon = 'Dir'; }
      else if (typeChar === 'l') { type = 'link'; icon = 'Lnk'; }

      let size = 0;
      let sizeFormatted = type === 'directory' ? '<DIR>' : '0 B';
      if (type === 'file') {
        for (let i = 1; i < parts.length - 1; i++) {
          const num = parseInt(parts[i], 10);
          if (!isNaN(num) && num > 0 && num < 1e9) { size = num; break; }
        }
        if (size < 1024) sizeFormatted = `${size} B`;
        else if (size < 1024 * 1024) sizeFormatted = `${(size / 1024).toFixed(1)} KB`;
        else if (size < 1024 * 1024 * 1024) sizeFormatted = `${(size / (1024*1024)).toFixed(1)} MB`;
        else sizeFormatted = `${(size / (1024*1024*1024)).toFixed(1)} GB`;
      }

      const isHidden = name.startsWith('.');
      const isExecutable = permissions.includes('x');
      const fullPath = this.currentPath === '/' ? `/${name}` : `${this.currentPath}/${name}`;
      const modifiedTime = Math.floor(Date.now() / 1000);

      return {
        name, type, size, sizeFormatted, modifiedTime,
        modifiedTimeFormatted: formatTime(modifiedTime),
        permissions, isHidden, fullPath, icon, isExecutable
      };
    },

    updateStats() {
      this.totalFiles = this.fileList.length;
      this.totalSize = this.fileList.filter(f => f.type === 'file').reduce((sum, f) => sum+f.size, 0);
      this.selectedCount = 0;
    },

    async openItem(item: FileItem) {
      if (item.type === 'directory') { this.currentPath = item.fullPath; await this.loadDirectory(); return; }
      await this.openFile(item);
    },

    async openFile(file: FileItem) {
      try {
        const exists = await Shell.exec(`test -f "${file.fullPath.replace(/"/g,'\\"')}" && echo "exists" || echo "not exists"`);
        if (exists.trim() === 'not exists') { showError(`文件不存在: ${file.fullPath}`); return; }

        const isText = file.name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|cfg|log|conf|ini|yml|yaml)$/i);
        if (isText) {
          $falcon.navTo('fileEditor', { filePath: file.fullPath, returnTo: 'fileManager', returnPath: this.currentPath });
        } else showInfo(`打开文件: ${file.name} (暂不支持此类型)`);
      } catch (error: any) { showError(`打开文件失败: ${error.message}`); }
    },

    async renameItem(item: FileItem) {
      openSoftKeyboard(
        () => item.name,
        async (newName) => {
          if (!newName.trim() || newName === item.name) { showInfo('名称未改变'); return; }
          try {
            showLoading();
            const newPath = this.currentPath === '/' ? `/${newName}` : `${this.currentPath}/${newName}`;
            await Shell.exec(`mv "${item.fullPath.replace(/"/g,'\\"')}" "${newPath.replace(/"/g,'\\"')}"`);
            showSuccess(`重命名成功: ${item.name} -> ${newName}`);
            await this.loadDirectory();
          } catch (e: any) { showError(`重命名失败: ${e.message}`); } finally { hideLoading(); }
        },
        (v) => { if (!v.trim()) return '请输入名称'; if (v.includes('/')) return '名称不能包含斜杠'; return undefined; }
      );
    },

    async deleteItem(item: FileItem) {
      this.showConfirmModal = true;
      this.confirmTitle = '确认删除';
      this.confirmMessage = `确定要删除 ${item.name} 吗？此操作不可恢复！`;
      this.confirmCallback = async () => {
        try {
          showLoading();
          await Shell.exec(`rm -rf "${item.fullPath.replace(/"/g,'\\"')}"`);
          showSuccess(`删除成功: ${item.name}`);
          await this.loadDirectory();
        } catch (e: any) { showError(`删除失败: ${e.message}`); } finally { hideLoading(); this.showConfirmModal=false; }
      };
    },

    copyFilePath(item: FileItem) { showInfo(`文件路径: ${item.fullPath}`); },

    showFileProperties(item: FileItem) {
      const prop = `
名称: ${item.name}
类型: ${item.type==='directory'?'目录':'文件'}
大小: ${item.sizeFormatted}
修改时间: ${item.modifiedTimeFormatted}
权限: ${item.permissions}
路径: ${item.fullPath}
隐藏: ${item.isHidden?'是':'否'}
可执行: ${item.isExecutable?'是':'否'}
      `.trim();
      showInfo(prop);
    },

    toggleHiddenFiles() { this.showHiddenFiles=!this.showHiddenFiles; this.$forceUpdate(); },
    searchFiles() { openSoftKeyboard(() => this.searchKeyword, v=>{ this.searchKeyword=v; this.$forceUpdate(); }); },
    clearSearch() { this.searchKeyword=''; this.$forceUpdate(); },
    formatSize(bytes:number) { if(bytes<1024) return bytes+' B'; if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB'; if(bytes<1024*1024*1024)return (bytes/(1024*1024)).toFixed(1)+' MB'; return (bytes/(1024*1024*1024)).toFixed(1)+' GB'; },
    getFileIconClass(f:FileItem){ let base='file-icon'; if(f.type==='directory') return base+' file-icon-folder'; if(f.name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) return base+' file-icon-image'; if(f.name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|cfg|sh)$/i)) return base+' file-icon-text'; if(f.isExecutable || f.name.match(/\.(sh|bash|amr|apk|bin|so)$/i)) return base+' file-icon-executable'; return base+' file-icon-file'; },

    handleFileSaved(e:{data:string}){ this.loadDirectory(); },
    handleBackPress() { if(this.showContextMenu||this.showConfirmModal){this.showContextMenu=false; this.showConfirmModal=false; return;} if(this.canGoBack){this.goBack(); return;} this.$page.finish(); },
    executeConfirmAction(){ if(this.confirmCallback) this.confirmCallback(); this.showConfirmModal=false; this.confirmCallback=null; },
    cancelConfirmAction(){ this.showConfirmModal=false; this.confirmCallback=null; },

    async goBack(){ if(!this.canGoBack) return; this.currentPath=this.parentPath; await this.loadDirectory(); },
    async refreshDirectory(){ await this.loadDirectory(); showSuccess('已刷新'); },
    async createNewFile(){ openSoftKeyboard(()=>'', async name=>{ if(!name.trim()){showWarning('文件名不能为空'); return;} try{ showLoading(); const full=this.currentPath==='/'?`/${name}`:`${this.currentPath}/${name}`; await Shell.exec(`touch "${full.replace(/"/g,'\\"')}"`); showSuccess('创建成功'); await this.loadDirectory();} catch(e:any){showError(`创建失败: ${e.message}`);} finally{hideLoading();} }, v=>{ if(!v.trim()) return '请输入文件名'; if(v.includes('/')) return '文件名不能含斜杠'; return undefined; }); },
    async createNewDirectory(){ openSoftKeyboard(()=>'', async name=>{ if(!name.trim()){showWarning('目录名不能为空'); return;} try{ showLoading(); const full=this.currentPath==='/'?`/${name}`:`${this.currentPath}/${name}`; await Shell.exec(`mkdir -p "${full.replace(/"/g,'\\"')}"`); showSuccess('创建成功'); await this.loadDirectory(); } catch(e:any){showError(`创建失败: ${e.message}`);} finally{hideLoading();} }, v=>{ if(!v.trim()) return '请输入目录名'; if(v.includes('/')) return '目录名不能含斜杠'; return undefined; }); },

    async testDirectoryFunctions() { console.log(this.currentPath, this.fileList.length); },
  }
});
