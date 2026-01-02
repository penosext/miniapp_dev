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
import { showError, showSuccess, showInfo, showWarning } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';

export type UpdateOptions = {};

// GitHub配置
const GITHUB_OWNER = 'penosext';
const GITHUB_REPO = 'miniapp';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// 当前版本号（每次发布需要更新）
const CURRENT_VERSION = '1.0.0';

interface GitHubRelease {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
        size: number;
    }>;
}

const update = defineComponent({
    data() {
        return {
            $page: {} as FalconPage<UpdateOptions>,
            
            // 状态
            status: 'idle' as 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'updated' | 'error',
            errorMessage: '',
            
            // 版本信息
            currentVersion: CURRENT_VERSION,
            latestRelease: null as GitHubRelease | null,
            
            // 下载信息
            downloadProgress: 0,
            downloadSpeed: 0,
            downloadedSize: 0,
            totalSize: 0,
            downloadPath: '',
            
            // Shell状态
            shellInitialized: false,
            
            // 重试次数
            retryCount: 0,
            maxRetries: 3,
        };
    },

    async mounted() {
        await this.initializeShell();
        this.checkForUpdates();
    },

    computed: {
        statusText(): string {
            switch (this.status) {
                case 'idle': return '准备检查更新';
                case 'checking': return '正在检查更新...';
                case 'available': return '发现新版本';
                case 'downloading': return '正在下载更新...';
                case 'installing': return '正在安装...';
                case 'updated': return '已是最新版本';
                case 'error': return '检查更新失败';
                default: return '';
            }
        },

        statusClass(): string {
            switch (this.status) {
                case 'checking': return 'status-checking';
                case 'available': return 'status-available';
                case 'updated': return 'status-updated';
                case 'error': return 'status-error';
                default: return '';
            }
        },

        hasUpdate(): boolean {
            if (!this.latestRelease) return false;
            return this.compareVersions(this.latestRelease.tag_name, this.currentVersion) > 0;
        },

        downloadFile(): { name: string; url: string; size: number } | null {
            if (!this.latestRelease || !this.latestRelease.assets.length) return null;
            
            // 查找.amr文件，支持多种命名方式
            const amrAsset = this.latestRelease.assets.find(asset => 
                asset.name.endsWith('.amr') || 
                asset.name.includes('miniapp') ||
                asset.name.includes('release')
            );
            
            if (amrAsset) {
                // 使用原始GitHub链接，不通过代理
                return {
                    name: amrAsset.name,
                    url: amrAsset.browser_download_url,
                    size: amrAsset.size
                };
            }
            
            return null;
        },

        formattedFileSize(): string {
            const size = this.totalSize || this.downloadFile?.size || 0;
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
            return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        },

        formattedDownloadedSize(): string {
            if (this.downloadedSize < 1024) return `${this.downloadedSize} B`;
            if (this.downloadedSize < 1024 * 1024) return `${(this.downloadedSize / 1024).toFixed(1)} KB`;
            return `${(this.downloadedSize / (1024 * 1024)).toFixed(1)} MB`;
        },
    },

    methods: {
        // 初始化Shell
        async initializeShell() {
            try {
                if (!Shell || typeof Shell.initialize !== 'function') {
                    throw new Error('Shell模块不可用');
                }
                
                await Shell.initialize();
                this.shellInitialized = true;
            } catch (error: any) {
                console.error('Shell初始化失败:', error);
                this.shellInitialized = false;
            }
        },

        // 检查更新 - 只使用GitHub Release API
        async checkForUpdates() {
            this.status = 'checking';
            this.errorMessage = '';
            this.retryCount = 0;
            
            try {
                showLoading();
                await this.fetchReleaseData();
                
                if (this.hasUpdate) {
                    this.status = 'available';
                    showInfo(`发现新版本 ${this.latestRelease!.tag_name}`);
                } else {
                    this.status = 'updated';
                    showSuccess('已是最新版本');
                }
                
            } catch (error: any) {
                console.error('检查更新失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '网络连接失败';
                showError(`检查更新失败: ${this.errorMessage}`);
            } finally {
                hideLoading();
            }
        },

        // 获取Release数据 - 解决403问题的核心
        async fetchReleaseData(): Promise<void> {
            // 准备多个User-Agent
            const userAgents = [
                'Mozilla/5.0 (Linux; Android 10; YoudaoDictionaryPen) AppleWebKit/537.36',
                'Mozilla/5.0 (Linux; U; Android 10; zh-cn; YoudaoDictionaryPen) AppleWebKit/537.36',
                'miniapp-updater/1.0',
                'curl/7.68.0',
                'GitHub-Release-Checker/1.0'
            ];
            
            // 准备多个Accept头
            const acceptHeaders = [
                'application/vnd.github.v3+json',
                'application/json',
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            ];
            
            for (let i = 0; i < this.maxRetries; i++) {
                try {
                    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
                    const acceptHeader = acceptHeaders[Math.floor(Math.random() * acceptHeaders.length)];
                    
                    console.log(`尝试第 ${i + 1} 次，使用User-Agent: ${userAgent}`);
                    
                    const response = await $falcon.jsapi.http.request({
                        url: GITHUB_API,
                        method: 'GET',
                        headers: {
                            'User-Agent': userAgent,
                            'Accept': acceptHeader,
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        },
                        timeout: 15000 // 15秒超时
                    });
                    
                    console.log('GitHub API响应状态:', response.statusCode);
                    
                    if (response.statusCode === 200) {
                        this.latestRelease = response.data as GitHubRelease;
                        console.log('成功获取Release数据:', this.latestRelease);
                        return; // 成功，退出函数
                    } else if (response.statusCode === 403) {
                        // 403错误，可能是请求频率限制
                        const resetTime = response.headers['x-ratelimit-reset'] || '60';
                        const waitTime = parseInt(resetTime) * 1000 - Date.now();
                        
                        if (waitTime > 0 && waitTime < 60000) {
                            console.log(`遇到频率限制，等待 ${Math.ceil(waitTime / 1000)} 秒后重试`);
                            showWarning(`GitHub API频率限制，等待 ${Math.ceil(waitTime / 1000)} 秒`);
                            await this.delay(Math.min(waitTime, 30000)); // 最多等待30秒
                        }
                        
                        throw new Error(`GitHub API返回 ${response.statusCode}，可能被频率限制`);
                    } else if (response.statusCode === 404) {
                        throw new Error('未找到Release，请确认仓库名正确');
                    } else {
                        throw new Error(`GitHub API返回错误: ${response.statusCode}`);
                    }
                    
                } catch (error: any) {
                    console.error(`第 ${i + 1} 次尝试失败:`, error);
                    this.retryCount = i + 1;
                    
                    // 如果不是最后一次尝试，等待后重试
                    if (i < this.maxRetries - 1) {
                        const waitTime = Math.pow(2, i) * 1000; // 指数退避
                        console.log(`等待 ${waitTime / 1000} 秒后重试`);
                        await this.delay(waitTime);
                    } else {
                        // 最后一次尝试也失败，抛出错误
                        throw error;
                    }
                }
            }
            
            throw new Error('所有尝试都失败了');
        },

        // 比较版本号
        compareVersions(v1: string, v2: string): number {
            // 移除v前缀
            const version1 = v1.replace(/^v/, '').split('.').map(Number);
            const version2 = v2.replace(/^v/, '').split('.').map(Number);
            
            for (let i = 0; i < Math.max(version1.length, version2.length); i++) {
                const num1 = version1[i] || 0;
                const num2 = version2[i] || 0;
                
                if (num1 > num2) return 1;
                if (num1 < num2) return -1;
            }
            
            return 0;
        },

        // 下载更新
        async downloadUpdate() {
            if (!this.shellInitialized || !Shell || !this.downloadFile) {
                showError('无法下载更新，Shell模块未初始化或没有下载文件');
                return;
            }
            
            this.status = 'downloading';
            this.downloadProgress = 0;
            this.downloadedSize = 0;
            this.totalSize = this.downloadFile.size;
            
            try {
                showLoading('开始下载...');
                
                // 设置下载路径
                this.downloadPath = `/userdisk/miniapp_update_${Date.now()}.amr`;
                
                console.log('开始下载:', this.downloadFile.url);
                console.log('保存到:', this.downloadPath);
                
                // 使用curl下载文件，增加重试和超时设置
                const downloadCmd = `curl -k -L --retry 3 --retry-delay 5 --connect-timeout 30 --max-time 300 "${this.downloadFile.url}" -o "${this.downloadPath}"`;
                
                console.log('执行下载命令:', downloadCmd);
                
                // 执行下载命令
                const result = await Shell.exec(downloadCmd);
                console.log('下载命令执行结果:', result);
                
                // 检查文件是否下载成功
                const checkCmd = `test -f "${this.downloadPath}" && echo "exists" || echo "not exists"`;
                const checkResult = await Shell.exec(checkCmd);
                
                if (checkResult.trim() === 'exists') {
                    // 获取文件大小
                    const sizeCmd = `stat -c%s "${this.downloadPath}" 2>/dev/null || wc -c < "${this.downloadPath}"`;
                    const sizeResult = await Shell.exec(sizeCmd);
                    const actualSize = parseInt(sizeResult.trim()) || 0;
                    
                    console.log('文件下载成功，大小:', actualSize, '字节');
                    
                    if (actualSize > 10000) { // 确保文件不是空的（至少10KB）
                        showSuccess('下载完成，开始安装');
                        await this.installUpdate();
                    } else {
                        throw new Error(`下载的文件大小异常: ${actualSize} 字节`);
                    }
                } else {
                    throw new Error('文件下载失败，文件不存在');
                }
                
            } catch (error: any) {
                console.error('下载失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '下载失败';
                showError(`下载失败: ${this.errorMessage}`);
                
                // 清理可能的部分文件
                if (this.downloadPath) {
                    try {
                        await Shell.exec(`rm -f "${this.downloadPath}"`);
                    } catch (cleanupError) {
                        console.warn('清理临时文件失败:', cleanupError);
                    }
                }
                
                // 提供手动安装说明
                if (this.downloadFile) {
                    showInfo(`你可以手动下载: ${this.downloadFile.url}`);
                    showInfo(`然后执行: miniapp_cli install 文件路径`);
                }
            } finally {
                hideLoading();
            }
        },

        // 安装更新
        async installUpdate() {
            if (!this.shellInitialized || !Shell) {
                showError('无法安装更新');
                return;
            }
            
            this.status = 'installing';
            
            try {
                showLoading('正在安装...');
                
                // 执行安装命令
                const installCmd = `miniapp_cli install "${this.downloadPath}"`;
                console.log('执行安装命令:', installCmd);
                
                const result = await Shell.exec(installCmd);
                console.log('安装结果:', result);
                
                // 检查安装是否成功（根据miniapp_cli的输出来判断）
                if (result.includes('success') || result.includes('Success') || 
                    result.includes('安装') || result.trim() === '') {
                    showSuccess('安装完成！请重启应用');
                    this.status = 'updated';
                } else {
                    throw new Error(`安装命令返回: ${result}`);
                }
                
                // 清理下载的文件
                setTimeout(async () => {
                    try {
                        await Shell.exec(`rm -f "${this.downloadPath}"`);
                        console.log('清理临时文件成功');
                    } catch (e) {
                        console.warn('清理临时文件失败:', e);
                    }
                }, 3000);
                
            } catch (error: any) {
                console.error('安装失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '安装失败';
                showError(`安装失败: ${this.errorMessage}`);
                
                // 提供手动安装说明
                showInfo(`你可以手动安装: miniapp_cli install ${this.downloadPath}`);
            } finally {
                hideLoading();
            }
        },

        // 延迟函数
        delay(ms: number): Promise<void> {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        // 格式化日期
        formatDate(dateString: string): string {
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (e) {
                return dateString;
            }
        },

        // 手动检查更新
        forceCheck() {
            this.checkForUpdates();
        },

        // 清理临时文件
        async cleanup() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            try {
                showLoading('正在清理...');
                const result = await Shell.exec('find /userdisk -name "miniapp_update_*.amr" -type f -delete 2>/dev/null || true');
                console.log('清理结果:', result);
                showSuccess('清理完成');
            } catch (error: any) {
                console.error('清理失败:', error);
                showError(`清理失败: ${error.message}`);
            } finally {
                hideLoading();
            }
        },

        // 查看GitHub Release页面
        openGitHubRelease() {
            const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
            showInfo(`请访问GitHub查看Release: ${url}`);
        },

        // 复制下载链接
        copyDownloadLink() {
            if (this.downloadFile) {
                showInfo(`下载链接已复制（模拟）: ${this.downloadFile.url}`);
                // 在实际设备上，你可能需要使用设备的剪贴板功能
            }
        }
    }
});

export default update;
