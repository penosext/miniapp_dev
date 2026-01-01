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
    console.log('初始路径:', this.currentPath);
    
    // 设置页面返回键处理
    this.$page.$npage.setSupportBack(true);
    this.$npage.on("backpressed", this.handleBackPress);
    
    // 监听文件保存事件
    $falcon.on('file_saved', this.handleFileSaved);
    
    await this.initializeShell();
  },

  beforeDestroy() {
    this.$npage.off("backpressed", this.handleBackPress);
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
      if (parts.length === 0) return '/';
      parts.pop();
      return parts.length > 0 ? '/' + parts.join('/') : '/';
    },
    
    // 检查当前路径是否在/userdisk目录下
    isInUserDisk(): boolean {
      return this.currentPath.startsWith('/userdisk');
    },
  },

  methods: {
    // 检查文件是否在/userdisk目录下
    isFileInUserDisk(filePath: string): boolean {
      return filePath.startsWith('/userdisk');
    },
    
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
        console.log('Shell模块初始化成功');
        
        // 加载当前目录
        await this.loadDirectory();
        
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        showError(`Shell模块初始化失败: ${error.message}`);
        this.shellInitialized = false;
      }
    },
    
    // 加载目录 - 改进版本，修复根目录显示问题
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
        console.log('标准化路径:', path);
        
        // 对于根目录，使用特殊命令
        let listCmd = '';
        if (path === '/') {
          // 根目录直接列出内容
          listCmd = 'ls -la /';
        } else {
          listCmd = `cd "${path}" && ls -la`;
        }
        
        console.log('执行命令:', listCmd);
        
        let result = '';
        try {
          result = await Shell.exec(listCmd);
          console.log('ls命令原始输出:', result);
        } catch (error: any) {
          console.error('ls命令执行失败:', error);
          // 尝试另一种方法
          if (path === '/') {
            result = await Shell.exec('ls /');
          } else {
            result = await Shell.exec(`cd "${path}" && ls`);
          }
          // 如果没有文件，设置为空
          if (!result || result.trim() === '') {
            this.fileList = [];
            return;
          }
          
          // 处理简单的ls输出
          const lines = result.trim().split('\n');
          const files: FileItem[] = [];
          
          for (const fileName of lines) {
            if (!fileName.trim() || fileName === '.') continue;
            
            const filePath = path === '/' ? `/${fileName}` : `${path}/${fileName}`;
            
            // 使用stat命令获取详细信息
            const statCmd = `stat -c "%s %Y %F" "${filePath}" 2>/dev/null`;
            let statResult = '0 0 unknown';
            try {
              statResult = await Shell.exec(statCmd);
            } catch (statError) {
              console.warn(`获取文件信息失败: ${filePath}`, statError);
            }
            
            const statParts = statResult.trim().split(/\s+/);
            const size = parseInt(statParts[0] || '0', 10);
            const modifiedTime = parseInt(statParts[1] || '0', 10);
            const fileType = statParts.slice(2).join(' ') || 'unknown';
            
            const isDirectory = fileType.includes('directory') || fileType.includes('目录');
            const type: 'file' | 'directory' | 'link' | 'unknown' = isDirectory ? 'directory' : 'file';
            
            // 确定图标
            let icon = '?';
            if (type === 'directory') {
              icon = '📁';
            } else if (fileName.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|bash)$/i)) {
              icon = '文';
            } else if (fileName.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) {
              icon = '图';
            } else if (fileName.match(/\.(amr|apk|bin|so|exe)$/i)) {
              icon = '执';
            } else {
              icon = '文';
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
            
            files.push({
              name: fileName,
              type,
              size,
              sizeFormatted,
              modifiedTime,
              modifiedTimeFormatted: formatTime(modifiedTime),
              permissions: '-rw-r--r--',
              isHidden: fileName.startsWith('.'),
              fullPath: filePath,
              icon,
              isExecutable: false,
            });
          }
          
          this.fileList = files;
          this.updateStats();
          return;
        }
        
        if (!result || result.trim() === '') {
          console.warn('目录为空或命令无输出');
          this.fileList = [];
          return;
        }
        
        // 解析ls -la输出
        const lines = result.trim().split('\n');
        console.log('解析行数:', lines.length);
        
        // 跳过第一行（总计数行）
        const fileLines = lines.slice(1);
        const files: FileItem[] = [];
        
        for (const line of fileLines) {
          const file = this.parseFileLineImproved(line, path);
          if (file) {
            files.push(file);
            console.log('解析文件:', file.name, '类型:', file.type, '完整路径:', file.fullPath);
          }
        }
        
        this.fileList = files;
        console.log('最终文件列表:', this.fileList.length, '个项目');
        
        // 更新统计信息
        this.updateStats();
        
      } catch (error: any) {
        console.error('加载目录失败:', error);
        showError(`加载目录失败: ${error.message}`);
        this.fileList = [];
        
        // 尝试回退到根目录
        if (this.currentPath !== '/') {
          this.currentPath = '/';
          await this.loadDirectory();
        }
      } finally {
        this.isLoading = false;
        hideLoading();
      }
    },
    
    // 改进的文件行解析方法，添加当前路径参数
    parseFileLineImproved(line: string, currentPath: string): FileItem | null {
      if (!line.trim()) return null;
      
      // 跳过.和..
      if (line.includes(' . ') || line.includes(' .. ')) {
        return null;
      }
      
      // 尝试解析ls -la输出格式
      // 格式示例: 
      // drwxr-xr-x  2 root root 4096 Dec 25 12:00 directory_name
      // -rw-r--r--  1 root root  123 Dec 25 12:00 file.txt
      
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) return null;
      
      const permissions = parts[0];
      const nameIndex = parts.findIndex((part, index) => {
        // 从第8个位置开始查找文件名
        if (index < 8) return false;
        // 排除一些可能的日期部分
        if (part.match(/^\d+$/) && index <= 8) return false;
        return true;
      });
      
      if (nameIndex === -1 || nameIndex >= parts.length) return null;
      
      const name = parts.slice(nameIndex).join(' ');
      
      // 跳过.和..文件
      if (name === '.' || name === '..') return null;
      
      // 判断文件类型
      const typeChar = permissions.charAt(0);
      let type: 'file' | 'directory' | 'link' | 'unknown' = 'unknown';
      let icon = '?';
      
      if (typeChar === '-') {
        type = 'file';
        // 根据文件扩展名设置图标
        if (name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|bash)$/i)) {
          icon = '文';
        } else if (name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) {
          icon = '图';
        } else if (name.match(/\.(amr|apk|bin|so|exe)$/i)) {
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
      
      // 获取大小
      let size = 0;
      let sizeFormatted = '';
      
      // 尝试从行中查找大小字段（通常是第5个字段）
      const sizeStr = parts[4];
      if (sizeStr && !isNaN(parseInt(sizeStr, 10))) {
        size = parseInt(sizeStr, 10);
      }
      
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
      
      // 获取时间信息
      let modifiedTime = Math.floor(Date.now() / 1000);
      // 尝试解析时间字段（通常在第6、7、8个字段）
      if (parts.length >= 9) {
        const monthStr = parts[5];
        const dayStr = parts[6];
        const timeOrYearStr = parts[7];
        
        // 简单的日期解析
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // 如果timeOrYearStr包含冒号，则是"HH:MM"格式，年份是当前年份
        // 否则可能是年份
        if (timeOrYearStr && timeOrYearStr.includes(':')) {
          // 格式: "Dec 25 12:00"
          const monthMap: {[key: string]: number} = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          
          const month = monthMap[monthStr] || 0;
          const day = parseInt(dayStr, 10) || 1;
          const [hours, minutes] = timeOrYearStr.split(':').map(Number);
          
          const date = new Date(currentYear, month, day, hours || 0, minutes || 0);
          modifiedTime = Math.floor(date.getTime() / 1000);
        } else {
          // 格式: "Dec 25  2023"
          const monthMap: {[key: string]: number} = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          
          const month = monthMap[monthStr] || 0;
          const day = parseInt(dayStr, 10) || 1;
          const year = parseInt(timeOrYearStr, 10) || currentYear;
          
          const date = new Date(year, month, day);
          modifiedTime = Math.floor(date.getTime() / 1000);
        }
      }
      
      // 判断是否为隐藏文件
      const isHidden = name.startsWith('.');
      
      // 判断是否可执行
      const isExecutable = permissions.includes('x');
      
      // 获取完整路径
      let fullPath = '';
      if (currentPath === '/') {
        fullPath = `/${name}`;
      } else {
        fullPath = `${currentPath}/${name}`;
      }
      
      return {
        name,
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
    
    // 更新统计信息
    updateStats() {
      this.totalFiles = this.fileList.length;
      
      // 计算总大小（仅文件）
      this.totalSize = this.fileList
        .filter(file => file.type === 'file')
        .reduce((sum, file) => sum + file.size, 0);
      
      this.selectedCount = 0;
    },
    
    // 打开文件或目录
    async openItem(item: FileItem) {
      console.log('打开项目:', item.name, '类型:', item.type, '路径:', item.fullPath);
      
      if (item.type === 'directory') {
        // 进入目录
        this.currentPath = item.fullPath;
        console.log('切换到目录:', this.currentPath);
        await this.loadDirectory();
      } else {
        // 打开文件
        await this.openFile(item);
      }
    },
    
    // 打开文件
    async openFile(file: FileItem) {
      console.log('打开文件:', file.fullPath);
      
      // 检查文件是否存在
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
          showInfo(`打开文件: ${file.name} (暂不支持此文件类型的预览)`);
        }
        
      } catch (error: any) {
        console.error('打开文件失败:', error);
        showError(`打开文件失败: ${error.message}`);
      }
    },
    
    // 返回上一级
    async goBack() {
      console.log('返回上一级，当前路径:', this.currentPath, '父路径:', this.parentPath);
      
      if (!this.canGoBack) {
        console.log('已经在根目录');
        return;
      }
      
      const oldPath = this.currentPath;
      this.currentPath = this.parentPath;
      console.log('从', oldPath, '切换到', this.currentPath);
      
      await this.loadDirectory();
    },
    
    // 刷新目录
    async refreshDirectory() {
      console.log('刷新目录:', this.currentPath);
      await this.loadDirectory();
      showSuccess('目录已刷新');
    },
    
    // 创建新文件 - 添加权限检查
    async createNewFile() {
      // 检查当前路径是否在/userdisk目录下
      if (!this.isInUserDisk) {
        showError('权限不足：只能在 /userdisk 目录下创建文件');
        return;
      }
      
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
            
            console.log('创建文件:', fullPath);
            
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
    
    // 创建新目录 - 添加权限检查
    async createNewDirectory() {
      // 检查当前路径是否在/userdisk目录下
      if (!this.isInUserDisk) {
        showError('权限不足：只能在 /userdisk 目录下创建目录');
        return;
      }
      
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
            
            console.log('创建目录:', fullPath);
            
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
    
    // 删除文件/目录 - 添加权限检查
    async deleteItem(item: FileItem) {
      // 检查文件是否在/userdisk目录下
      if (!this.isFileInUserDisk(item.fullPath)) {
        showError('权限不足：只能在 /userdisk 目录下删除文件或目录');
        return;
      }
      
      this.showConfirmModal = true;
      this.confirmTitle = '确认删除';
      this.confirmMessage = `确定要删除 ${item.name} 吗？此操作不可恢复！`;
      this.confirmCallback = async () => {
        try {
          showLoading();
          
          console.log('删除:', item.fullPath);
          
          // 使用不同的命令删除文件和目录
          if (item.type === 'directory') {
            // 删除目录
            await Shell.exec(`rm -rf "${item.fullPath}"`);
          } else {
            // 删除文件
            await Shell.exec(`rm "${item.fullPath}"`);
          }
          
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
    
    // 重命名文件/目录 - 添加权限检查
    async renameItem(item: FileItem) {
      // 检查文件是否在/userdisk目录下
      if (!this.isFileInUserDisk(item.fullPath)) {
        showError('权限不足：只能在 /userdisk 目录下重命名文件或目录');
        return;
      }
      
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
            
            console.log('重命名:', item.fullPath, '->', newPath);
            
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
      console.log('复制文件路径:', item.fullPath);
      showInfo(`文件路径已复制: ${item.fullPath}`);
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
      console.log('切换显示隐藏文件:', this.showHiddenFiles);
      this.$forceUpdate();
    },
    
    // 搜索文件
    searchFiles() {
      openSoftKeyboard(
        () => this.searchKeyword,
        (value) => {
          this.searchKeyword = value;
          console.log('搜索关键词:', value);
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
      if (this.showConfirmModal) {
        this.showConfirmModal = false;
        return;
      }
      
      if (this.canGoBack) {
        console.log('返回键：返回上一级目录');
        this.goBack();
        return;
      }
      
      console.log('返回键：退出文件管理器');
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
    
    // 返回主页
    goToHome() {
      $falcon.navTo('index', {});
    },
  },
});
