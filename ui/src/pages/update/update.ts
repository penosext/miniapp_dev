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

// 当前版本号（每次发布需要更新）- 已自动更新为1.2.10.5
const CURRENT_VERSION = '1.2.10.5';
// 设备型号（根据设备设置）- 已通过构建脚本设置
const DEVICE_MODEL = 'a6p'; // 例如: a6p, a6x, a5, c7 等

// 镜像源配置 - 添加buttonName字段显示简短名称
const MIRRORS = [
    {
        id: 'github',
        name: 'github',
        buttonName: 'github',
        enabled: false,
        urlPattern: '{url}',
        apiPattern: '{url}',
        testUrl: 'https://github.com'
    },
    {
        id: 'ghproxy',
        name: 'ghproxy',
        buttonName: 'ghproxy源',
        enabled: true,
        urlPattern: 'https://ghproxy.net/{url}',
        apiPattern: '{url}',
        testUrl: 'https://ghproxy.net/https://github.com'
    },
    {
        id: 'langningchen',
        name: 'langningchen',
        buttonName: 'langningchen源',
        enabled: true,
        urlPattern: 'https://proxy.langningchen.com/{url}',
        apiPattern: '{url}',
        testUrl: 'https://proxy.langningchen.com/https://github.com'
    },
    {
        id: 'fastgit',
        name: 'FastGit',
        buttonName: 'FastGit源',
        enabled: true,
        urlPattern: 'https://download.fastgit.org/{path}',
        apiPattern: 'https://api.fastgit.org/{path}',
        testUrl: 'https://download.fastgit.org'
    },
    {
        id: 'ghproxycn',
        name: 'ghproxycn',
        buttonName: 'ghproxycn源',
        enabled: true,
        urlPattern: 'https://ghproxy.com/{url}',
        apiPattern: '{url}',
        testUrl: 'https://ghproxy.com/https://github.com'
    },
    {
        id: 'kgithub',
        name: 'kgithub',
        buttonName: 'kgithub源',
        enabled: true,
        urlPattern: 'https://kgithub.com/{path}',
        apiPattern: 'https://api.kgithub.com/{path}',
        testUrl: 'https://kgithub.com'
    },
    {
        id: 'hubfast',
        name: 'hubfast',
        buttonName: 'hubfast源',
        enabled: true,
        urlPattern: 'https://hub.fastgit.xyz/{path}',
        apiPattern: 'https://hub.fastgit.xyz/api/{path}',
        testUrl: 'https://hub.fastgit.xyz'
    }
];

// 版本信息接口
interface ReleaseVersion {
    version: string;
    date: string;
    notes: string;
    downloadUrl: string;
    fileSize: number;
    isLatest?: boolean;
    releaseDate?: string;
    assetName?: string;
}

// 已下载版本信息接口
interface DownloadedVersion {
    version: string;
    downloadTime: string;
    filePath: string;
    fileSize: number;
    deviceModel: string;
}

const update = defineComponent({
    data() {
        return {
            $page: {},
            
            // 状态
            status: 'idle',
            errorMessage: '',
            
            // 版本信息
            currentVersion: CURRENT_VERSION,
            latestVersion: '',
            releaseNotes: '',
            downloadUrl: '',
            fileSize: 0,
            
            // 设备型号（使用常量）
            deviceModel: DEVICE_MODEL,
            
            // 下载信息
            downloadPath: '',
            
            // Shell状态
            shellInitialized: false,
            
            // 镜像源设置
            mirrors: MIRRORS,
            selectedMirror: 'langningchen',
            useMirror: true,
            currentMirror: MIRRORS.find(m => m.id === 'langningchen') || MIRRORS[0],
            
            // 历史版本列表
            historyVersions: [],
            
            // 当前下载的历史版本
            downloadingHistoryVersion: null,
            
            // 已下载历史版本缓存
            downloadedVersions: [],
            
            // 展开的版本列表
            expandedVersions: [],
        };
    },

    async mounted() {
        await this.initializeShell();
        await this.autoCheckUpdates();
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
            if (!this.latestVersion) return false;
            return this.compareVersions(this.latestVersion, this.currentVersion) > 0;
        },

        formattedFileSize(): string {
            const size = this.fileSize;
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
            return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        },

        // 显示版本信息，包括型号
        versionInfo(): string {
            if (this.latestVersion) {
                return `最新版本: v${this.latestVersion} (${this.deviceModel} 型号)`;
            }
            return `当前版本: v${this.currentVersion} (${this.deviceModel} 型号)`;
        },

        // 当前设备对应的预期文件名
        currentDeviceFilename(): string {
            if (this.latestVersion) {
                return `miniapp_${this.deviceModel}_v${this.latestVersion}.amr`;
            }
            return `miniapp_${this.deviceModel}_v${this.currentVersion}.amr`;
        },

        // 显示更新状态摘要
        updateStatusSummary(): string {
            if (this.status === 'checking') return '正在检查更新...';
            if (this.status === 'available') return `发现新版本 v${this.latestVersion} (${this.deviceModel})`;
            if (this.status === 'updated') return `已是最新版本 v${this.currentVersion} (${this.deviceModel})`;
            if (this.status === 'error') return '检查更新失败';
            return `当前版本: v${this.currentVersion} (${this.deviceModel})`;
        },

        // 获取所有版本（包含最新版和历史版）
        allVersions() {
            const all = [...this.historyVersions];
            // 确保最新版本在前
            if (this.latestVersion) {
                const latest = all.find(v => v.version === this.latestVersion);
                if (latest) {
                    const others = all.filter(v => v.version !== this.latestVersion);
                    return [latest, ...others];
                }
            }
            return all;
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
                console.log(`设备型号: ${this.deviceModel}`);
            } catch (error) {
                console.error('Shell初始化失败:', error);
                this.shellInitialized = false;
            }
        },

        // 页面加载时自动检查更新
        async autoCheckUpdates() {
            // 等待Shell初始化完成
            setTimeout(async () => {
                if (this.shellInitialized) {
                    await this.checkForUpdates();
                } else {
                    // 如果Shell未初始化，等待一段时间再重试
                    setTimeout(() => {
                        if (this.shellInitialized) {
                            this.checkForUpdates();
                        }
                    }, 2000);
                }
            }, 1000);
        },

        // 检查更新（获取所有版本）
        async checkForUpdates() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            this.status = 'checking';
            this.errorMessage = '';
            this.historyVersions = []; // 清空历史版本
            
            try {
                showLoading('正在检查更新...');
                
                // 获取所有版本（不仅仅是最新版本）
                const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
                console.log('获取所有版本，URL:', apiUrl);
                console.log('设备型号:', this.deviceModel);
                console.log('当前版本:', this.currentVersion);
                
                // 尝试不同的curl命令选项
                const curlCommands = [
                    `curl -s -k -L "${apiUrl}"`,
                    `curl -s -k -H "Accept: application/json" "${apiUrl}"`,
                    `curl -s -k -H "User-Agent: miniapp" "${apiUrl}"`
                ];
                
                let result = '';
                let success = false;
                
                for (const cmd of curlCommands) {
                    try {
                        console.log('尝试命令:', cmd);
                        result = await Shell.exec(cmd);
                        
                        if (result && result.trim() !== '') {
                            success = true;
                            break;
                        }
                    } catch (cmdError) {
                        console.log('命令失败:', cmd, cmdError);
                    }
                }
                
                if (!success) {
                    throw new Error('无法获取版本信息');
                }
                
                // 解析JSON
                let releases;
                try {
                    releases = JSON.parse(result);
                    console.log('GitHub API响应，版本数量:', releases.length);
                } catch (parseError) {
                    console.error('JSON解析失败:', parseError, '原始数据:', result);
                    throw new Error('数据格式错误');
                }
                
                if (!Array.isArray(releases)) {
                    throw new Error('数据格式错误');
                }
                
                // 处理每个版本（最多10个）
                const processedVersions = [];
                for (const release of releases.slice(0, 10)) {
                    if (release.tag_name) {
                        // 获取版本号（移除可能的v前缀）
                        const tagVersion = release.tag_name.replace(/^v/, '');
                        
                        // 跳过当前版本
                        if (tagVersion === this.currentVersion) continue;
                        
                        // 查找匹配设备型号的.amr文件
                        let matchedAsset = null;
                        if (release.assets && Array.isArray(release.assets)) {
                            console.log(`版本 ${tagVersion} 的资源文件:`, release.assets.map((a: any) => a.name));
                            
                            // 构建预期的文件名
                            const expectedFilename = `miniapp_${this.deviceModel}_v${tagVersion}.amr`;
                            console.log('预期的文件名:', expectedFilename);
                            
                            // 查找完全匹配的文件
                            matchedAsset = release.assets.find((asset: any) => 
                                asset.name && asset.name === expectedFilename
                            );
                            
                            // 如果未找到完全匹配的文件，尝试查找包含型号和版本的文件
                            if (!matchedAsset) {
                                matchedAsset = release.assets.find((asset: any) => 
                                    asset.name && 
                                    asset.name.includes(this.deviceModel) && 
                                    asset.name.includes(tagVersion) &&
                                    asset.name.endsWith('.amr')
                                );
                            }
                            
                            // 如果还未找到，尝试查找包含型号的文件
                            if (!matchedAsset) {
                                matchedAsset = release.assets.find((asset: any) => 
                                    asset.name && 
                                    asset.name.includes(this.deviceModel) &&
                                    asset.name.endsWith('.amr')
                                );
                            }
                            
                            // 如果还未找到，使用第一个.amr文件
                            if (!matchedAsset) {
                                matchedAsset = release.assets.find((asset: any) => 
                                    asset.name && asset.name.endsWith('.amr')
                                );
                            }
                            
                            if (matchedAsset) {
                                const versionInfo = {
                                    version: tagVersion,
                                    date: release.created_at || release.published_at || '',
                                    notes: release.body || '暂无更新说明',
                                    downloadUrl: matchedAsset.browser_download_url,
                                    fileSize: matchedAsset.size || 0,
                                    assetName: matchedAsset.name,
                                    releaseDate: release.published_at ? this.formatDate(release.published_at) : '未知'
                                };
                                
                                processedVersions.push(versionInfo);
                                console.log(`找到版本 ${tagVersion}, 文件: ${matchedAsset.name}, 大小: ${versionInfo.fileSize}`);
                            }
                        }
                    }
                }
                
                // 排序：最新版本在前
                processedVersions.sort((a, b) => this.compareVersions(b.version, a.version));
                
                // 设置历史版本
                this.historyVersions = processedVersions;
                
                // 如果有版本，设置最新版本信息
                if (processedVersions.length > 0) {
                    const latestVersionInfo = processedVersions[0];
                    latestVersionInfo.isLatest = true;
                    
                    this.latestVersion = latestVersionInfo.version;
                    this.releaseNotes = latestVersionInfo.notes;
                    this.downloadUrl = latestVersionInfo.downloadUrl;
                    this.fileSize = latestVersionInfo.fileSize;
                    
                    console.log(`设置最新版本: ${this.latestVersion}`);
                }
                
                // 设置状态
                if (this.hasUpdate) {
                    this.status = 'available';
                    showInfo(`发现新版本 ${this.latestVersion} (${this.deviceModel})`);
                } else {
                    this.status = 'updated';
                    showSuccess(`已是最新版本 v${this.currentVersion} (${this.deviceModel})`);
                }
                
                // 加载已下载的历史版本缓存
                await this.loadDownloadedVersions();
                
            } catch (error) {
                console.error('检查更新失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '网络连接失败';
                showError(`检查更新失败: ${this.errorMessage}`);
            } finally {
                hideLoading();
            }
        },

        // 比较版本号
        compareVersions(v1, v2) {
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

        // 下载更新（最新版本）
        async downloadUpdate() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            if (!this.downloadUrl) {
                showError('没有可用的下载链接');
                return;
            }
            
            this.status = 'downloading';
            
            try {
                showLoading(`正在下载 ${this.deviceModel} 型号的更新...`);
                
                // 设置下载路径，包含型号和版本信息
                const timestamp = Date.now();
                this.downloadPath = `/userdisk/miniapp_${this.deviceModel}_v${this.latestVersion}_${timestamp}.amr`;
                
                // 根据是否使用镜像源构建下载URL
                let finalDownloadUrl = this.downloadUrl;
                if (this.useMirror && this.currentMirror.enabled) {
                    if (this.currentMirror.urlPattern.includes('{url}')) {
                        finalDownloadUrl = this.currentMirror.urlPattern.replace('{url}', this.downloadUrl);
                    } else if (this.currentMirror.urlPattern.includes('{path}')) {
                        const urlObj = new URL(this.downloadUrl);
                        const path = urlObj.pathname + urlObj.search;
                        finalDownloadUrl = this.currentMirror.urlPattern.replace('{path}', path);
                    }
                }
                
                console.log('下载URL:', finalDownloadUrl);
                console.log('保存到:', this.downloadPath);
                console.log('设备型号:', this.deviceModel);
                console.log('目标版本:', this.latestVersion);
                console.log('使用镜像:', this.useMirror ? this.currentMirror.name : '无');
                
                // 使用curl下载文件
                const downloadCmd = `curl -k -L "${finalDownloadUrl}" -o "${this.downloadPath}"`;
                console.log('执行命令:', downloadCmd);
                
                await Shell.exec(downloadCmd);
                
                // 检查文件是否下载成功
                const checkCmd = `test -f "${this.downloadPath}" && echo "exists"`;
                const checkResult = await Shell.exec(checkCmd);
                
                if (checkResult.trim() === 'exists') {
                    // 获取文件大小
                    const sizeCmd = `wc -c < "${this.downloadPath}"`;
                    const fileSize = parseInt(await Shell.exec(sizeCmd)) || 0;
                    console.log(`文件下载成功，大小: ${fileSize} 字节`);
                    
                    if (fileSize > 0) {
                        showSuccess(`${this.deviceModel} 型号的更新下载完成，开始安装`);
                        await this.installUpdate();
                    } else {
                        throw new Error('下载的文件为空');
                    }
                } else {
                    throw new Error('文件下载失败');
                }
                
            } catch (error) {
                console.error('下载失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '下载失败';
                showError(`下载失败: ${this.errorMessage}`);
                
                // 提供手动安装说明
                if (this.downloadUrl) {
                    showInfo(`手动下载 ${this.deviceModel} 型号的更新: ${this.downloadUrl}`);
                    showInfo(`下载后执行: miniapp_cli install 文件名.amr`);
                }
            } finally {
                hideLoading();
            }
        },

        // 安装更新（最新版本）
        async installUpdate() {
            if (!this.shellInitialized || !Shell) {
                showError('无法安装更新');
                return;
            }
            
            this.status = 'installing';
            
            try {
                showLoading(`正在安装 ${this.deviceModel} 型号的更新...`);
                
                // 执行安装命令
                const installCmd = `miniapp_cli install "${this.downloadPath}"`;
                console.log('执行安装命令:', installCmd);
                console.log('设备型号:', this.deviceModel);
                console.log('安装文件:', this.downloadPath);
                
                const result = await Shell.exec(installCmd);
                console.log('安装结果:', result);
                await Shell.exec('rm -f /userdisk/miniapp_*_v*_*.amr 2>/dev/null || true');
                await Shell.exec('rm -f /userdisk/miniapp_update_*.amr 2>/dev/null || true');
                
                showSuccess(`${this.deviceModel} 型号的更新安装完成！请重启应用`);
                this.status = 'updated';
                
                // 清理下载的文件
                setTimeout(async () => {
                    try {
                        await Shell.exec(`rm -f "${this.downloadPath}"`);
                        console.log('清理临时文件成功');
                    } catch (e) {
                        console.warn('清理临时文件失败:', e);
                    }
                }, 3000);
                
            } catch (error) {
                console.error('安装失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '安装失败';
                showError(`安装失败: ${this.errorMessage}`);
                
                showInfo(`手动安装 ${this.deviceModel} 型号的更新:`);
                showInfo(`miniapp_cli install ${this.downloadPath}`);
            } finally {
                hideLoading();
            }
        },

        // 下载历史版本
        async downloadHistoryVersion(version) {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            this.downloadingHistoryVersion = version.version;
            
            try {
                showLoading(`正在下载历史版本 v${version.version}...`);
                
                // 设置下载路径，包含版本信息
                const timestamp = Date.now();
                const downloadPath = `/userdisk/miniapp_${this.deviceModel}_v${version.version}_${timestamp}.amr`;
                
                // 根据是否使用镜像源构建下载URL
                let finalDownloadUrl = version.downloadUrl;
                if (this.useMirror && this.currentMirror.enabled) {
                    if (this.currentMirror.urlPattern.includes('{url}')) {
                        finalDownloadUrl = this.currentMirror.urlPattern.replace('{url}', version.downloadUrl);
                    } else if (this.currentMirror.urlPattern.includes('{path}')) {
                        const urlObj = new URL(version.downloadUrl);
                        const path = urlObj.pathname + urlObj.search;
                        finalDownloadUrl = this.currentMirror.urlPattern.replace('{path}', path);
                    }
                }
                
                console.log('下载历史版本 URL:', finalDownloadUrl);
                console.log('保存到:', downloadPath);
                
                // 使用curl下载文件
                const downloadCmd = `curl -k -L "${finalDownloadUrl}" -o "${downloadPath}"`;
                await Shell.exec(downloadCmd);
                
                // 检查文件是否下载成功
                const checkCmd = `test -f "${downloadPath}" && echo "exists"`;
                const checkResult = await Shell.exec(checkCmd);
                
                if (checkResult.trim() === 'exists') {
                    // 获取文件大小
                    const sizeCmd = `wc -c < "${downloadPath}"`;
                    const fileSize = parseInt(await Shell.exec(sizeCmd)) || 0;
                    
                    if (fileSize > 0) {
                        // 保存下载记录
                        const downloadRecord = {
                            version: version.version,
                            downloadTime: new Date().toISOString(),
                            filePath: downloadPath,
                            fileSize: fileSize,
                            deviceModel: this.deviceModel
                        };
                        
                        // 添加到已下载列表
                        this.downloadedVersions.push(downloadRecord);
                        
                        // 保存到本地存储
                        await this.saveDownloadedVersions();
                        
                        showSuccess(`历史版本 v${version.version} 下载完成`);
                        
                        // 自动展开该版本的详细信息
                        this.toggleVersionDetails(version.version);
                    } else {
                        throw new Error('下载的文件为空');
                    }
                } else {
                    throw new Error('文件下载失败');
                }
                
            } catch (error) {
                console.error('下载历史版本失败:', error);
                showError(`下载历史版本失败: ${error.message || '未知错误'}`);
                
                // 提供手动下载说明
                if (version.downloadUrl) {
                    showInfo(`手动下载: ${version.downloadUrl}`);
                }
            } finally {
                this.downloadingHistoryVersion = null;
                hideLoading();
            }
        },

        // 安装历史版本
        async installHistoryVersion(filePath, version) {
            if (!this.shellInitialized || !Shell) {
                showError('无法安装');
                return;
            }
            
            try {
                showLoading(`正在安装历史版本 v${version}...`);
                
                // 执行安装命令
                const installCmd = `miniapp_cli install "${filePath}"`;
                console.log('执行安装命令:', installCmd);
                
                await Shell.exec(installCmd);
                showSuccess(`历史版本 v${version} 安装完成！请重启应用`);
                
                // 清理其他历史版本文件
                await this.cleanupOldHistoryFiles();
                
            } catch (error) {
                console.error('安装历史版本失败:', error);
                showError(`安装失败: ${error.message || '未知错误'}`);
            } finally {
                hideLoading();
            }
        },

        // 加载已下载的历史版本
        async loadDownloadedVersions() {
            try {
                // 扫描目录查找已下载的文件
                const scanCmd = `find /userdisk -name "miniapp_${this.deviceModel}_v*.amr" 2>/dev/null | head -10`;
                const result = await Shell.exec(scanCmd);
                
                if (result.trim()) {
                    const files = result.trim().split('\n');
                    for (const file of files) {
                        if (file.trim()) {
                            try {
                                // 解析文件名获取版本信息
                                const filename = file.split('/').pop() || '';
                                const regex = new RegExp(`miniapp_${this.deviceModel}_v(\\d+\\.\\d+\\.\\d+)_(\\d+)\\.amr`);
                                const match = filename.match(regex);
                                
                                if (match) {
                                    const version = match[1];
                                    const timestamp = parseInt(match[2]);
                                    
                                    // 获取文件大小
                                    const sizeCmd = `wc -c < "${file}"`;
                                    const fileSize = parseInt(await Shell.exec(sizeCmd)) || 0;
                                    
                                    this.downloadedVersions.push({
                                        version: version,
                                        downloadTime: new Date(timestamp).toISOString(),
                                        filePath: file,
                                        fileSize: fileSize,
                                        deviceModel: this.deviceModel
                                    });
                                }
                            } catch (e) {
                                console.warn('解析已下载文件失败:', file, e);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('加载已下载版本失败:', error);
            }
        },

        // 保存已下载版本记录
        async saveDownloadedVersions() {
            try {
                // 限制最多保存5个下载记录
                if (this.downloadedVersions.length > 5) {
                    this.downloadedVersions = this.downloadedVersions.slice(-5);
                }
                console.log('已下载版本:', this.downloadedVersions);
            } catch (error) {
                console.warn('保存下载记录失败:', error);
            }
        },

        // 清理旧的历史文件
        async cleanupOldHistoryFiles() {
            try {
                // 保留最新3个历史文件，删除其他
                const cleanupCmd = `ls -t /userdisk/miniapp_${this.deviceModel}_v*.amr 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true`;
                await Shell.exec(cleanupCmd);
                console.log('清理旧历史文件完成');
            } catch (error) {
                console.warn('清理历史文件失败:', error);
            }
        },

        // 选择镜像源
        selectMirror(mirrorId) {
            const mirror = this.mirrors.find(m => m.id === mirrorId);
            if (mirror) {
                this.selectedMirror = mirrorId;
                this.currentMirror = mirror;
                this.useMirror = mirror.enabled;
                showInfo(`已切换到镜像源: ${mirror.name}`);
            }
        },

        // 手动检查更新
        forceCheck() {
            this.checkForUpdates();
        },

        // 查看GitHub页面
        openGitHub() {
            const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
            showInfo(`请访问: ${url}`);
        },

        // 显示设备信息
        showDeviceInfo() {
            showInfo(`设备型号: ${this.deviceModel}\n当前版本: v${this.currentVersion}`);
        },

        // 格式化日期
        formatDate(dateString) {
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('zh-CN');
            } catch (e) {
                return dateString;
            }
        },

        // 格式化文件大小
        formatFileSize(bytes) {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        },

        // 切换版本详情显示
        toggleVersionDetails(version) {
            const index = this.expandedVersions.indexOf(version);
            if (index > -1) {
                this.expandedVersions.splice(index, 1);
            } else {
                this.expandedVersions.push(version);
            }
        },

        // 显示文件路径
        showFilePath(filePath) {
            showInfo(`文件路径: ${filePath}\n\n安装命令:\nminiapp_cli install "${filePath}"`);
        },

        // 获取已下载的版本
        getDownloadedVersion(version) {
            return this.downloadedVersions.find(v => v.version === version);
        },

        // 显示安装路径
        showInstallPath(version) {
            const downloaded = this.getDownloadedVersion(version);
            if (downloaded) {
                this.showFilePath(downloaded.filePath);
            } else {
                showError('该版本尚未下载');
            }
        },

        // 清空已下载版本
        clearDownloadedVersions() {
            this.downloadedVersions = [];
            showInfo('已清空下载记录');
        }
    }
});

export default update;
