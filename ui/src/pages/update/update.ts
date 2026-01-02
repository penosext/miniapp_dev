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
import { showError, showSuccess, showInfo } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';

export type UpdateOptions = {};

// GitHub配置
const GITHUB_OWNER = 'penosext';
const GITHUB_REPO = 'miniapp';

// 当前版本号
const CURRENT_VERSION = '1.0.0';
// 设备型号
const DEVICE_MODEL = 'a6p';

// 接口定义
interface ReleaseAsset {
    name: string;
    browser_download_url: string;
    size: number;
}

interface ReleaseData {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    assets: ReleaseAsset[];
}

interface DownloadFile {
    name: string;
    size: number;
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
            latestRelease: null as ReleaseData | null,
            downloadFile: null as DownloadFile | null,
            
            // 设备型号
            deviceModel: DEVICE_MODEL,
            
            // 下载信息
            downloadPath: '',
            
            // Shell状态
            shellInitialized: false,
        };
    },

    mounted() {
        this.initializeShell();
    },

    computed: {
        statusText(): string {
            switch (this.status) {
                case 'idle': return '准备就绪';
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
            if (!this.latestRelease || !this.latestRelease.tag_name) return false;
            const latestVersion = this.latestRelease.tag_name.replace(/^v/, '');
            const currentVersion = this.currentVersion.replace(/^v/, '');
            return this.compareVersions(latestVersion, currentVersion) > 0;
        },

        formattedFileSize(): string {
            if (!this.downloadFile || !this.downloadFile.size) return '未知大小';
            const size = this.downloadFile.size;
            if (size < 1024) return size + ' B';
            if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
            if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' MB';
            return (size / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
        },

        currentVersionText(): string {
            return 'v' + this.currentVersion + ' (' + this.deviceModel + ')';
        },

        latestVersionText(): string {
            if (!this.latestRelease || !this.latestRelease.tag_name) return '';
            return this.latestRelease.tag_name + ' (' + this.deviceModel + ')';
        },
    },

    methods: {
        // 初始化Shell
        initializeShell(): Promise<void> {
            return new Promise((resolve) => {
                if (!Shell || typeof Shell.initialize !== 'function') {
                    console.warn('Shell模块不可用');
                    resolve();
                    return;
                }
                
                Shell.initialize().then(() => {
                    this.shellInitialized = true;
                    console.log('Shell初始化成功');
                    console.log('设备型号: ' + this.deviceModel);
                    // 延迟检查更新，避免立即执行
                    setTimeout(() => {
                        this.checkForUpdates();
                    }, 1000);
                    resolve();
                }).catch((error: any) => {
                    console.error('Shell初始化失败:', error);
                    this.shellInitialized = false;
                    resolve();
                });
            });
        },

        // 检查更新
        checkForUpdates() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            this.status = 'checking';
            this.errorMessage = '';
            this.latestRelease = null;
            this.downloadFile = null;
            
            showLoading('正在检查更新...');
            
            // 使用简单的方式获取数据
            const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
            console.log('检查更新，URL:', apiUrl);
            
            // 简单的curl命令
            const curlCmd = `curl -s -k -L "${apiUrl}"`;
            
            Shell.exec(curlCmd).then((result: string) => {
                hideLoading();
                
                if (!result || result.trim() === '') {
                    throw new Error('无法获取更新信息');
                }
                
                let data: any;
                try {
                    data = JSON.parse(result);
                    console.log('GitHub API响应成功');
                } catch (parseError) {
                    console.error('JSON解析失败:', parseError);
                    throw new Error('数据格式错误');
                }
                
                if (data.tag_name) {
                    // 保存数据
                    this.latestRelease = data as ReleaseData;
                    
                    // 查找匹配设备型号的文件
                    if (data.assets && Array.isArray(data.assets)) {
                        const tagVersion = data.tag_name.replace(/^v/, '');
                        const expectedFilename = `miniapp_${this.deviceModel}_v${tagVersion}.amr`;
                        
                        let matchedAsset: ReleaseAsset | null = null;
                        
                        // 查找匹配的文件
                        for (const asset of data.assets) {
                            if (asset.name && asset.name === expectedFilename) {
                                matchedAsset = asset;
                                break;
                            }
                        }
                        
                        // 如果未找到完全匹配的文件，尝试查找包含型号的文件
                        if (!matchedAsset) {
                            for (const asset of data.assets) {
                                if (asset.name && asset.name.includes(this.deviceModel) && asset.name.endsWith('.amr')) {
                                    matchedAsset = asset;
                                    break;
                                }
                            }
                        }
                        
                        // 如果还未找到，使用第一个.amr文件
                        if (!matchedAsset) {
                            for (const asset of data.assets) {
                                if (asset.name && asset.name.endsWith('.amr')) {
                                    matchedAsset = asset;
                                    break;
                                }
                            }
                        }
                        
                        if (matchedAsset) {
                            this.downloadFile = {
                                name: matchedAsset.name,
                                size: matchedAsset.size || 0
                            };
                            console.log('找到匹配的文件:', matchedAsset.name);
                        }
                    }
                    
                    // 检查是否有更新
                    if (this.hasUpdate) {
                        this.status = 'available';
                        showInfo('发现新版本 ' + data.tag_name + ' (' + this.deviceModel + ')');
                    } else {
                        this.status = 'updated';
                        showSuccess('已是最新版本 v' + this.currentVersion + ' (' + this.deviceModel + ')');
                    }
                } else {
                    throw new Error('无效的Release数据');
                }
            }).catch((error: any) => {
                hideLoading();
                console.error('检查更新失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '网络连接失败';
                showError('检查更新失败: ' + this.errorMessage);
            });
        },

        // 比较版本号
        compareVersions(v1: string, v2: string): number {
            const version1 = v1.split('.').map(Number);
            const version2 = v2.split('.').map(Number);
            
            for (let i = 0; i < Math.max(version1.length, version2.length); i++) {
                const num1 = version1[i] || 0;
                const num2 = version2[i] || 0;
                
                if (num1 > num2) return 1;
                if (num1 < num2) return -1;
            }
            
            return 0;
        },

        // 下载更新
        downloadUpdate() {
            if (!this.shellInitialized || !Shell || !this.latestRelease || !this.downloadFile) {
                showError('无法下载更新');
                return;
            }
            
            this.status = 'downloading';
            
            const tagVersion = this.latestRelease.tag_name.replace(/^v/, '');
            const downloadUrl = this.getDownloadUrl();
            
            if (!downloadUrl) {
                showError('没有可用的下载链接');
                this.status = 'error';
                return;
            }
            
            // 设置下载路径
            const timestamp = Date.now();
            this.downloadPath = `/userdisk/miniapp_${this.deviceModel}_v${tagVersion}_${timestamp}.amr`;
            
            showLoading('正在下载更新...');
            
            const downloadCmd = `curl -k -L "${downloadUrl}" -o "${this.downloadPath}"`;
            
            Shell.exec(downloadCmd).then(() => {
                // 检查文件是否存在
                const checkCmd = `test -f "${this.downloadPath}" && echo "exists"`;
                return Shell.exec(checkCmd);
            }).then((result: string) => {
                if (result.trim() === 'exists') {
                    hideLoading();
                    showSuccess('下载完成，开始安装');
                    this.installUpdate();
                } else {
                    throw new Error('文件下载失败');
                }
            }).catch((error: any) => {
                hideLoading();
                console.error('下载失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '下载失败';
                showError('下载失败: ' + this.errorMessage);
            });
        },

        // 获取下载URL
        getDownloadUrl(): string {
            if (!this.latestRelease || !this.latestRelease.assets) return '';
            
            const tagVersion = this.latestRelease.tag_name.replace(/^v/, '');
            const expectedFilename = `miniapp_${this.deviceModel}_v${tagVersion}.amr`;
            
            // 查找完全匹配的文件
            for (const asset of this.latestRelease.assets) {
                if (asset.name === expectedFilename) {
                    return asset.browser_download_url;
                }
            }
            
            // 查找包含型号的文件
            for (const asset of this.latestRelease.assets) {
                if (asset.name.includes(this.deviceModel) && asset.name.endsWith('.amr')) {
                    return asset.browser_download_url;
                }
            }
            
            // 返回第一个.amr文件
            for (const asset of this.latestRelease.assets) {
                if (asset.name.endsWith('.amr')) {
                    return asset.browser_download_url;
                }
            }
            
            return '';
        },

        // 安装更新
        installUpdate() {
            if (!this.shellInitialized || !Shell || !this.downloadPath) {
                showError('无法安装更新');
                return;
            }
            
            this.status = 'installing';
            showLoading('正在安装更新...');
            
            const installCmd = `miniapp_cli install "${this.downloadPath}"`;
            
            Shell.exec(installCmd).then((result: string) => {
                hideLoading();
                console.log('安装结果:', result);
                showSuccess('安装完成！请重启应用');
                this.status = 'updated';
                
                // 清理文件
                setTimeout(() => {
                    this.cleanupFile(this.downloadPath);
                }, 3000);
            }).catch((error: any) => {
                hideLoading();
                console.error('安装失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '安装失败';
                showError('安装失败: ' + this.errorMessage);
            });
        },

        // 清理文件
        cleanupFile(filePath: string) {
            if (!this.shellInitialized || !Shell) return;
            
            Shell.exec(`rm -f "${filePath}"`).then(() => {
                console.log('清理临时文件成功');
            }).catch((error: any) => {
                console.warn('清理临时文件失败:', error);
            });
        },

        // 手动检查更新
        forceCheck() {
            this.checkForUpdates();
        },

        // 清理临时文件
        cleanup() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            showLoading('正在清理...');
            
            Shell.exec('rm -f /userdisk/miniapp_*.amr 2>/dev/null || true').then(() => {
                hideLoading();
                showSuccess('清理完成');
            }).catch((error: any) => {
                hideLoading();
                showError('清理失败: ' + error.message);
            });
        },

        // 查看GitHub页面
        openGitHub() {
            const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
            showInfo('请访问: ' + url);
        },

        // 格式化日期
        formatDate(dateString: string): string {
            try {
                const date = new Date(dateString);
                return date.getFullYear() + '-' + 
                       (date.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                       date.getDate().toString().padStart(2, '0');
            } catch (e) {
                return dateString;
            }
        },
    }
});

export default update;