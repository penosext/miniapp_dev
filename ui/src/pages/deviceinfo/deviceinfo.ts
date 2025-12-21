// device.ts
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

export default defineComponent({
    data() {
        return {
            $page: {} as FalconPage<any>,
            shellInitialized: false,
            isLoading: true,
            
            // 设备基本信息
            deviceModel: '',
            deviceName: '',
            kernelVersion: '',
            osVersion: '',
            hostname: '',
            uptime: '',
            
            // CPU信息
            cpuModel: '',
            cpuCores: 0,
            cpuFrequency: '',
            cpuArch: '',
            cpuLoad: 0,
            
            // 内存信息
            totalMemory: 0,
            usedMemory: 0,
            freeMemory: 0,
            memoryUsage: 0,
            
            // 存储信息
            totalStorage: 0,
            usedStorage: 0,
            freeStorage: 0,
            storageUsage: 0,
            
            // 网络信息
            ipAddress: '',
            macAddress: '',
            networkStatus: '',
            
            // 系统信息
            systemTime: '',
            processes: 0,
            users: 0,
            batteryLevel: '未知',
            
            // 错误信息
            errorMessage: '',
            
            // 命令结果
            commandResult: '',
        };
    },

    async mounted() {
        console.log('设备信息页面加载...');
        await this.initializeShell();
        
        // 设置页面返回键处理
        this.$page.$npage.setSupportBack(true);
        this.$page.$npage.on("backpressed", this.handleBackPress);
    },

    beforeDestroy() {
        this.$page.$npage.off("backpressed", this.handleBackPress);
    },

    computed: {
        // 内存使用百分比
        memoryUsagePercent(): number {
            if (this.totalMemory === 0) return 0;
            return Math.round((this.usedMemory / this.totalMemory) * 100);
        },
        
        // 存储使用百分比
        storageUsagePercent(): number {
            if (this.totalStorage === 0) return 0;
            return Math.round((this.usedStorage / this.totalStorage) * 100);
        },
        
        // CPU负载百分比
        cpuLoadPercent(): number {
            return Math.round(this.cpuLoad * 100);
        },
        
        // 格式化内存大小
        formatMemory(): { total: string, used: string, free: string } {
            return {
                total: this.formatBytes(this.totalMemory),
                used: this.formatBytes(this.usedMemory),
                free: this.formatBytes(this.freeMemory),
            };
        },
        
        // 格式化存储大小
        formatStorage(): { total: string, used: string, free: string } {
            return {
                total: this.formatBytes(this.totalStorage),
                used: this.formatBytes(this.usedStorage),
                free: this.formatBytes(this.freeStorage),
            };
        },
        
        // 设备摘要
        deviceSummary(): string {
            if (this.deviceModel && this.deviceName) {
                return `${this.deviceModel} - ${this.deviceName}`;
            } else if (this.deviceModel) {
                return this.deviceModel;
            } else if (this.deviceName) {
                return this.deviceName;
            }
            return '未知设备';
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
                console.log('Shell模块初始化成功');
                
                // 获取设备信息
                await this.getAllDeviceInfo();
                
            } catch (error: any) {
                console.error('Shell模块初始化失败:', error);
                this.errorMessage = `Shell模块初始化失败: ${error.message}`;
                this.shellInitialized = false;
                this.isLoading = false;
            }
        },
        
        // 获取所有设备信息
        async getAllDeviceInfo() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            try {
                this.isLoading = true;
                showLoading();
                
                // 并行执行所有信息获取
                await Promise.all([
                    this.getSystemInfo(),
                    this.getCpuInfo(),
                    this.getMemoryInfo(),
                    this.getStorageInfo(),
                    this.getNetworkInfo(),
                    this.getMiscInfo(),
                ]);
                
                console.log('设备信息获取完成');
                showSuccess('设备信息已刷新');
                
            } catch (error: any) {
                console.error('获取设备信息失败:', error);
                this.errorMessage = `获取设备信息失败: ${error.message}`;
            } finally {
                this.isLoading = false;
                hideLoading();
            }
        },
        
        // 获取系统信息
        async getSystemInfo() {
            try {
                // 获取系统信息
                const unameResult = await Shell.exec('uname -a');
                this.kernelVersion = unameResult.trim();
                
                // 获取主机名
                const hostnameResult = await Shell.exec('hostname');
                this.hostname = hostnameResult.trim();
                
                // 获取设备型号（尝试多种方式）
                try {
                    // Android设备
                    const modelResult = await Shell.exec('getprop ro.product.model');
                    this.deviceModel = modelResult.trim() || '未知型号';
                    
                    const nameResult = await Shell.exec('getprop ro.product.name');
                    this.deviceName = nameResult.trim() || '未知设备';
                } catch {
                    // Linux设备
                    const modelResult = await Shell.exec('cat /proc/device-tree/model 2>/dev/null || echo "未知"');
                    this.deviceModel = modelResult.trim();
                }
                
                // 获取运行时间
                const uptimeResult = await Shell.exec('uptime');
                this.uptime = uptimeResult.trim();
                
                // 获取系统时间
                const dateResult = await Shell.exec('date');
                this.systemTime = dateResult.trim();
                
            } catch (error: any) {
                console.error('获取系统信息失败:', error);
                this.deviceModel = '获取失败';
                this.hostname = '获取失败';
            }
        },
        
        // 获取CPU信息
        async getCpuInfo() {
            try {
                // 获取CPU型号
                const cpuInfoResult = await Shell.exec('cat /proc/cpuinfo | grep "model name" | head -1 | cut -d: -f2');
                this.cpuModel = cpuInfoResult.trim() || '未知CPU';
                
                // 获取CPU核心数
                const coresResult = await Shell.exec('nproc');
                this.cpuCores = parseInt(coresResult.trim()) || 1;
                
                // 获取CPU架构
                const archResult = await Shell.exec('uname -m');
                this.cpuArch = archResult.trim();
                
                // 获取CPU频率（MHz）
                const freqResult = await Shell.exec('cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq 2>/dev/null || echo "0"');
                const freqMHz = parseInt(freqResult.trim()) || 0;
                this.cpuFrequency = freqMHz > 0 ? `${(freqMHz / 1000).toFixed(2)} GHz` : '未知';
                
                // 获取CPU负载
                const loadResult = await Shell.exec('uptime | awk -F"load average:" \'{print $2}\' | cut -d, -f1');
                this.cpuLoad = parseFloat(loadResult.trim()) || 0;
                
            } catch (error: any) {
                console.error('获取CPU信息失败:', error);
                this.cpuModel = '获取失败';
                this.cpuCores = 0;
            }
        },
        
        // 获取内存信息
        async getMemoryInfo() {
            try {
                // 获取内存信息
                const memResult = await Shell.exec('free -b');
                const memLines = memResult.trim().split('\n');
                
                if (memLines.length > 1) {
                    const memData = memLines[1].split(/\s+/).filter(Boolean);
                    if (memData.length >= 6) {
                        this.totalMemory = parseInt(memData[1]) || 0;
                        this.usedMemory = parseInt(memData[2]) || 0;
                        this.freeMemory = parseInt(memData[3]) || 0;
                    }
                }
                
            } catch (error: any) {
                console.error('获取内存信息失败:', error);
                this.totalMemory = 0;
                this.usedMemory = 0;
            }
        },
        
        // 获取存储信息
        async getStorageInfo() {
            try {
                // 获取根目录存储信息
                const dfResult = await Shell.exec('df -B1 / | tail -1');
                const dfData = dfResult.trim().split(/\s+/).filter(Boolean);
                
                if (dfData.length >= 5) {
                    this.totalStorage = parseInt(dfData[1]) || 0;
                    this.usedStorage = parseInt(dfData[2]) || 0;
                    this.freeStorage = parseInt(dfData[3]) || 0;
                }
                
            } catch (error: any) {
                console.error('获取存储信息失败:', error);
                this.totalStorage = 0;
                this.usedStorage = 0;
            }
        },
        
        // 获取网络信息
        async getNetworkInfo() {
            try {
                // 获取IP地址（优先获取内网IP）
                const ipResult = await Shell.exec('ip addr show | grep "inet " | grep -v "127.0.0.1" | head -1 | awk \'{print $2}\' | cut -d/ -f1');
                this.ipAddress = ipResult.trim() || '无网络连接';
                
                // 获取MAC地址
                const macResult = await Shell.exec('ip link show | grep "link/ether" | head -1 | awk \'{print $2}\'');
                this.macAddress = macResult.trim() || '未知';
                
                // 检查网络状态
                const pingResult = await Shell.exec('ping -c 1 -W 1 8.8.8.8 >/dev/null 2>&1 && echo "在线" || echo "离线"');
                this.networkStatus = pingResult.trim();
                
            } catch (error: any) {
                console.error('获取网络信息失败:', error);
                this.ipAddress = '获取失败';
                this.networkStatus = '未知';
            }
        },
        
        // 获取其他信息
        async getMiscInfo() {
            try {
                // 获取进程数
                const psResult = await Shell.exec('ps -A | wc -l');
                this.processes = parseInt(psResult.trim()) || 0;
                
                // 获取在线用户数
                const usersResult = await Shell.exec('who | wc -l');
                this.users = parseInt(usersResult.trim()) || 0;
                
                // 获取电池信息（Android设备）
                try {
                    const batteryResult = await Shell.exec('dumpsys battery 2>/dev/null | grep level | head -1 | awk \'{print $2}\'');
                    const batteryLevel = batteryResult.trim();
                    if (batteryLevel) {
                        this.batteryLevel = `${batteryLevel}%`;
                    } else {
                        this.batteryLevel = '未知';
                    }
                } catch {
                    this.batteryLevel = '未知';
                }
                
            } catch (error: any) {
                console.error('获取其他信息失败:', error);
                this.processes = 0;
                this.users = 0;
            }
        },
        
        // 格式化字节大小
        formatBytes(bytes: number): string {
            if (bytes === 0) return '0 B';
            
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        // 刷新所有信息
        async refreshAllInfo() {
            await this.getAllDeviceInfo();
        },
        
        // 运行系统诊断
        async runDiagnostics() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            try {
                showLoading();
                
                const diagnostics = [];
                
                // 检查系统服务
                diagnostics.push('=== 系统服务检查 ===');
                const services = await Shell.exec('ps -A | grep -E "(init|systemd)" | wc -l');
                diagnostics.push(`系统服务进程数: ${services.trim()}`);
                
                // 检查磁盘健康
                diagnostics.push('=== 磁盘健康检查 ===');
                try {
                    const diskHealth = await Shell.exec('df -h / | tail -1');
                    diagnostics.push(diskHealth.trim());
                } catch {
                    diagnostics.push('磁盘检查失败');
                }
                
                // 检查内存泄漏
                diagnostics.push('=== 内存使用检查 ===');
                const memLeak = await Shell.exec('free -h');
                diagnostics.push(memLeak.trim());
                
                // 检查网络连通性
                diagnostics.push('=== 网络连通性检查 ===');
                const networkCheck = await Shell.exec('ping -c 2 8.8.8.8 2>&1 | tail -2');
                diagnostics.push(networkCheck.trim());
                
                // 显示诊断结果
                showInfo(diagnostics.join('\n'));
                
            } catch (error: any) {
                console.error('系统诊断失败:', error);
                showError(`系统诊断失败: ${error.message}`);
            } finally {
                hideLoading();
            }
        },
        
        // 运行系统命令
        async runCommand(command: string) {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            try {
                showLoading();
                
                const result = await Shell.exec(command);
                
                // 截断过长的输出
                const maxLength = 500;
                let displayResult = result.trim();
                if (displayResult.length > maxLength) {
                    displayResult = displayResult.substring(0, maxLength) + '...\n(输出过长，已截断)';
                }
                
                showInfo(`命令: ${command}\n\n结果:\n${displayResult}`);
                
            } catch (error: any) {
                console.error('执行命令失败:', error);
                showError(`执行命令失败: ${error.message}`);
            } finally {
                hideLoading();
            }
        },
        
        // 处理返回键
        handleBackPress() {
            this.$page.finish();
        },
    },
});