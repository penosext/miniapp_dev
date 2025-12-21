// Copyright (C) 2025 Langning Chen
// 
// This file is part of miniapp.
// 
// miniapp is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// miniapp is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with miniapp.  If not, see <https://www.gnu.org/licenses/>.

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
      
      // 文件系统状态
      currentPath: '/',
      fileList: [] as FileItem[],
      shellInitialized: false,
      isLoading: false,
      
      // 操作状态
      showContextMenu: false,
      contextMenuX: 0,
      contextMenuY: 0,
      selectedFile: null as FileItem | null,
      showConfirmModal: false,
      confirmTitle: '',
      confirmMessage: '',
      confirmCallback: null as (() => void) | null,
      
      // 搜索状态
      searchKeyword: '',
      showHiddenFiles: false,
      
      // 统计信息
      totalFiles: 0,
      totalSize: 0,
      selectedCount: 0,
    };
  },

  async mounted() {
    console.log('文件管理器页面加载...');
    
    // 获取初始路径
    const options = this.$page.loadOptions;
    this.currentPath = options.path || '/';
    
    // 设置页面返回键处理
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on("backpressed", this.handleBackPress);
    
    // 监听文件保存事件
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
      
      // 过滤隐藏文件
      if (!this.showHiddenFiles) {
        files = files.filter(file => !file.isHidden);
      }
      
      // 过滤搜索关键词
      if (this.searchKeyword) {
        const keyword = this.searchKeyword.toLowerCase();
        files = files.filter(file => file.name.toLowerCase().includes(keyword));
      }
      
      // 排序：目录在前，文件在后，按名称排序
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
      const parts = this.currentPath.split('/').filter(part => part);
      parts.pop();
      return parts.length ? '/' + parts.join('/') : '/';
    },
  },

  methods: {
    // 初始化Shell
    async initializeShell() {
      try {
        if (!Shell) {
          throw new Error('Shell对象未定义');
        }
        
        if (typeof Shell.initialize !== 'function') {
          throw new Error('Shell.initialize方法不存在');
        }
        
        await Shell.initialize();
        this.shellInitialized = true;
        
        // 加载当前目录
        await this.loadDirectory();
        
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        showError(`Shell模块初始化失败: ${error.message}`);
        this.shellInitialized = false;
      }
    },
    
    // 加载目录
    async loadDirectory() {
      if (!this.shellInitialized || !Shell) {
        showError('Shell模块未初始化');
        return;
      }
      
      try {
        this.isLoading = true;
        showLoading();
        
        console.log('加载目录:', this.currentPath);
        
        // 确保路径格式正确
        let path = this.currentPath;
        if (!path.startsWith('/')) {
          path = '/' + path;
        }
        if (path !== '/' && path.endsWith('/')) {
          path = path.slice(0, -1);
        }
        this.currentPath = path;
        
        // 检查目录是否存在
        const checkCmd = `test -d "${path}" && echo "exists" || echo "not exists"`;
        const existsResult = await Shell.exec(checkCmd);
        
        if (existsResult.trim() === 'not exists') {
          showError(`目录不存在: ${path}`);
          this.currentPath = '/';
          await this.loadDirectory();
          return;
        }
        
        // 列出文件和目录
        const listCmd = `cd "${path}" && ls -la --time-style=+%s | tail -n +2`;
        const result = await Shell.exec(listCmd);
        
        // 解析结果
        this.parseFileList(result);
        
        // 更新统计信息
        this.updateStats();
        
      } catch (error: any) {
        console.error('加载目录失败:', error);
        showError(`加载目录失败: ${error.message}`);
        this.fileList = [];
      } finally {
        this.isLoading = false;
        hideLoading();
      }
    },
    
    // 解析文件列表
    parseFileList(lsOutput: string) {
      const files: FileItem[] = [];
      const lines = lsOutput.trim().split('\n');
      
      for (const line of lines) {
        const file = this.parseFileLine(line);
        if (file) {
          files.push(file);
        }
      }
      
      this.fileList = files;
    },
    
    // 解析单行文件信息
    parseFileLine(line: string): FileItem | null {
      // ls -la 输出格式示例:
      // drwxr-xr-x 2 user group 4096 1700000000 .
      // -rw-r--r-- 1 user group 1024 1700000000 file.txt
      const parts = line.trim().split(/\s+/);
      
      if (parts.length < 8) return null;
      
      const permissions = parts[0];
      // const links = parts[1];
      // const owner = parts[2];
      // const group = parts[3];
      const size = parseInt(parts[4], 10);
      const timestamp = parseInt(parts[5], 10);
      const name = parts.slice(6).join(' ');
      
      // 跳过 . 和 ..
      if (name === '.' || name === '..') return null;
      
      // 判断文件类型
      const typeChar = permissions[0];
      let type: 'file' | 'directory' | 'link' | 'unknown' = 'unknown';
      let icon = '?';
      
      if (typeChar === '-') {
        type = 'file';
        // 根据文件扩展名设置图标
        if (name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm)$/i)) {
          icon = '文';
        } else if (name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) {
          icon = '图';
        } else if (name.match(/\.(amr|apk|bin|so)$/i)) {
          icon = '执';
        } else {
          icon = '文';
        }
      } else if (typeChar === 'd') {
        type = 'directory';
        icon = '📁';
      } else if (typeChar === 'l') {
        type = 'link';
        icon = '🔗';
      }
      
      // 格式化大小
      let sizeFormatted = '';
      if (type === 'directory') {
        sizeFormatted = '<DIR>';
      } else if (size < 1024) {
        sizeFormatted = `${size} B`;
      } else if (size < 1024 * 1024) {
        sizeFormatted = `${(size / 1024).toFixed(1)} KB`;
      } else if (size < 1024 * 1024 * 1024) {
        sizeFormatted = `${(size / (1024 * 1024)).toFixed(1)} MB`;
      } else {
        sizeFormatted = `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }
      
      // 判断是否为隐藏文件
      const isHidden = name.startsWith('.');
      
      // 判断是否可执行
      const isExecutable = permissions.includes('x');
      
      // 获取完整路径
      const fullPath = this.currentPath === '/' 
        ? `/${name}` 
        : `${this.currentPath}/${name}`;
      
      return {
        name,
        type,
        size,
        sizeFormatted,
        modifiedTime: timestamp,
        modifiedTimeFormatted: formatTime(timestamp),
        permissions,
        isHidden,
        fullPath,
        icon,
        isExecutable,
      };
    },
    
    // 更新统计信息
    updateStats() {
      this.totalFiles = this.fileList.length;
      
      // 计算总大小（仅文件）
      this.totalSize = this.fileList
        .filter(file => file.type === 'file')
        .reduce((sum, file) => sum + file.size, 0);
      
      this.selectedCount = 0; // 重置选择计数
    },
    
    // 打开文件或目录
    async openItem(item: FileItem) {
      if (item.type === 'directory') {
        // 进入目录
        this.currentPath = item.fullPath;
        await this.loadDirectory();
      } else {
        // 打开文件
        await this.openFile(item);
      }
    },
    
    // 打开文件
    async openFile(file: FileItem) {
      console.log('打开文件:', file.fullPath);
      
      // 检查文件是否存在且可读
      try {
        const checkCmd = `test -f "${file.fullPath}" && echo "exists" || echo "not exists"`;
        const existsResult = await Shell.exec(checkCmd);
        
        if (existsResult.trim() === 'not exists') {
          showError(`文件不存在: ${file.fullPath}`);
          return;
        }
        
        // 判断文件类型，如果是文本文件则用编辑器打开
        const isTextFile = file.name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|bash|log|conf|ini|yml|yaml)$/i);
        
        if (isTextFile) {
          // 用文件编辑器打开
          $falcon.navTo('fileEditor', {
            filePath: file.fullPath,
            returnTo: 'fileManager',
            returnPath: this.currentPath,
          });
        } else {
          // 尝试用系统默认方式打开
          showInfo(`打开文件: ${file.name} (暂不支持此文件类型)`);
        }
        
      } catch (error: any) {
        console.error('打开文件失败:', error);
        showError(`打开文件失败: ${error.message}`);
      }
    },
    
    // 返回上一级
    async goBack() {
      if (!this.canGoBack) return;
      
      this.currentPath = this.parentPath;
      await this.loadDirectory();
    },
    
    // 刷新目录
    async refreshDirectory() {
      await this.loadDirectory();
      showSuccess('目录已刷新');
    },
    
    // 创建新文件
    async createNewFile() {
      openSoftKeyboard(
        () => '',
        async (fileName) => {
          if (!fileName.trim()) {
            showWarning('文件名不能为空');
            return;
          }
          
          try {
            showLoading();
            
            const fullPath = this.currentPath === '/' 
              ? `/${fileName}`
              : `${this.currentPath}/${fileName}`;
            
            // 创建空文件
            await Shell.exec(`touch "${fullPath}"`);
            
            showSuccess(`文件创建成功: ${fileName}`);
            await this.loadDirectory();
            
          } catch (error: any) {
            console.error('创建文件失败:', error);
            showError(`创建文件失败: ${error.message}`);
          } finally {
            hideLoading();
          }
        },
        (value) => {
          if (!value.trim()) return '请输入文件名';
          if (value.includes('/')) return '文件名不能包含斜杠';
          return undefined;
        }
      );
    },
    
    // 创建新目录
    async createNewDirectory() {
      openSoftKeyboard(
        () => '',
        async (dirName) => {
          if (!dirName.trim()) {
            showWarning('目录名不能为空');
            return;
          }
          
          try {
            showLoading();
            
            const fullPath = this.currentPath === '/' 
              ? `/${dirName}`
              : `${this.currentPath}/${dirName}`;
            
            // 创建目录
            await Shell.exec(`mkdir -p "${fullPath}"`);
            
            showSuccess(`目录创建成功: ${dirName}`);
            await this.loadDirectory();
            
          } catch (error: any) {
            console.error('创建目录失败:', error);
            showError(`创建目录失败: ${error.message}`);
          } finally {
            hideLoading();
          }
        },
        (value) => {
          if (!value.trim()) return '请输入目录名';
          if (value.includes('/')) return '目录名不能包含斜杠';
          return undefined;
        }
      );
    },
    
    // 删除文件/目录
    async deleteItem(item: FileItem) {
      this.showConfirmModal = true;
      this.confirmTitle = '确认删除';
      this.confirmMessage = `确定要删除 ${item.name} 吗？此操作不可恢复！`;
      this.confirmCallback = async () => {
        try {
          showLoading();
          
          // 使用 rm -rf 删除文件和目录
          await Shell.exec(`rm -rf "${item.fullPath}"`);
          
          showSuccess(`删除成功: ${item.name}`);
          await this.loadDirectory();
          
        } catch (error: any) {
          console.error('删除失败:', error);
          showError(`删除失败: ${error.message}`);
        } finally {
          hideLoading();
          this.showConfirmModal = false;
        }
      };
    },
    
    // 重命名文件/目录
    async renameItem(item: FileItem) {
      openSoftKeyboard(
        () => item.name,
        async (newName) => {
          if (!newName.trim() || newName === item.name) {
            if (newName === item.name) {
              showInfo('文件名未改变');
            }
            return;
          }
          
          try {
            showLoading();
            
            const newPath = this.currentPath === '/' 
              ? `/${newName}`
              : `${this.currentPath}/${newName}`;
            
            // 重命名
            await Shell.exec(`mv "${item.fullPath}" "${newPath}"`);
            
            showSuccess(`重命名成功: ${item.name} -> ${newName}`);
            await this.loadDirectory();
            
          } catch (error: any) {
            console.error('重命名失败:', error);
            showError(`重命名失败: ${error.message}`);
          } finally {
            hideLoading();
          }
        },
        (value) => {
          if (!value.trim()) return '请输入新名称';
          if (value.includes('/')) return '名称不能包含斜杠';
          if (value === item.name) return '新名称不能与原名相同';
          return undefined;
        }
      );
    },
    
    // 复制文件路径
    copyFilePath(item: FileItem) {
      // 这里可以集成到剪贴板功能
      showInfo(`文件路径已复制: ${item.fullPath}`);
      // 在实际应用中，可以将路径保存到全局变量或使用系统剪贴板
    },
    
    // 显示上下文菜单
    showContextMenu(event: any, item: FileItem) {
      this.selectedFile = item;
      this.contextMenuX = event.x || 100;
      this.contextMenuY = event.y || 100;
      this.showContextMenu = true;
      
      // 点击其他地方关闭菜单
      setTimeout(() => {
        const handler = () => {
          this.showContextMenu = false;
          document.removeEventListener('click', handler);
        };
        document.addEventListener('click', handler);
      }, 100);
    },
    
    // 执行上下文菜单操作
    async executeContextMenu(action: string) {
      if (!this.selectedFile) return;
      
      this.showContextMenu = false;
      
      switch (action) {
        case 'open':
          await this.openItem(this.selectedFile);
          break;
        case 'rename':
          await this.renameItem(this.selectedFile);
          break;
        case 'delete':
          await this.deleteItem(this.selectedFile);
          break;
        case 'copy_path':
          this.copyFilePath(this.selectedFile);
          break;
        case 'properties':
          this.showFileProperties(this.selectedFile);
          break;
      }
      
      this.selectedFile = null;
    },
    
    // 显示文件属性
    showFileProperties(item: FileItem) {
      const properties = `
文件名称: ${item.name}
文件类型: ${item.type === 'directory' ? '目录' : '文件'}
文件大小: ${item.sizeFormatted}
修改时间: ${item.modifiedTimeFormatted}
权限设置: ${item.permissions}
完整路径: ${item.fullPath}
隐藏文件: ${item.isHidden ? '是' : '否'}
可执行文件: ${item.isExecutable ? '是' : '否'}
      `.trim();
      
      showInfo(properties);
    },
    
    // 切换显示隐藏文件
    toggleHiddenFiles() {
      this.showHiddenFiles = !this.showHiddenFiles;
      this.$forceUpdate();
    },
    
    // 搜索文件
    searchFiles() {
      openSoftKeyboard(
        () => this.searchKeyword,
        (value) => {
          this.searchKeyword = value;
          this.$forceUpdate();
        }
      );
    },
    
    // 清除搜索
    clearSearch() {
      this.searchKeyword = '';
      this.$forceUpdate();
    },
    
    // 格式化大小
    formatSize(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    },
    
    // 获取文件图标类
    getFileIconClass(file: FileItem): string {
      let baseClass = 'file-icon';
      
      if (file.type === 'directory') {
        return `${baseClass} file-icon-folder`;
      }
      
      // 根据文件扩展名设置图标
      if (file.name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) {
        return `${baseClass} file-icon-image`;
      }
      
      if (file.name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm)$/i)) {
        return `${baseClass} file-icon-text`;
      }
      
      if (file.isExecutable || file.name.match(/\.(sh|bash|amr|apk|bin|so)$/i)) {
        return `${baseClass} file-icon-executable`;
      }
      
      return `${baseClass} file-icon-file`;
    },
    
    // 处理文件保存事件
    handleFileSaved(e: { data: string }) {
      console.log('收到文件保存事件:', e.data);
      // 刷新当前目录
      this.loadDirectory();
    },
    
    // 处理返回键
    handleBackPress() {
      if (this.showContextMenu || this.showConfirmModal) {
        this.showContextMenu = false;
        this.showConfirmModal = false;
        return;
      }
      
      if (this.canGoBack) {
        this.goBack();
        return;
      }
      
      this.$page.finish();
    },
    
    // 确认对话框相关
    executeConfirmAction() {
      if (this.confirmCallback) {
        this.confirmCallback();
      }
      this.showConfirmModal = false;
      this.confirmCallback = null;
    },
    
    cancelConfirmAction() {
      this.showConfirmModal = false;
      this.confirmCallback = null;
    },
  },
});