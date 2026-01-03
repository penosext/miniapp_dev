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
import { CURRENT_VERSION, DEVICE_MODEL, GITHUB_OWNER, GITHUB_REPO } from '../update/update.ts';

export type aboutOptions = {};

const about = defineComponent({
    data() {
        return {
            $page: {} as FalconPage<aboutOptions>,
            
            // 项目信息 - 从update.ts导入
            projectName: '词典笔工具箱',
            version: CURRENT_VERSION,
            deviceModel: DEVICE_MODEL,
            description: '这是一个简单易用的词典笔工具箱，专为词典笔设备设计。应用集成了AI智能助手、文件管理器、文本编辑器、终端命令执行、系统信息查看等多项实用功能。界面简洁直观，操作流畅便捷，支持离线使用，为词典笔用户提供全方位的工具支持，大幅提升使用效率和体验。',
            
            // 鸣谢信息
            credits: [
                { name: '@wyxdlz54188', role: '核心开发' },
                { name: '@langningchen', role: '核心开发' }
            ],
            
            // GitHub 信息 - 从update.ts导入
            githubOwner: GITHUB_OWNER,
            githubRepo: GITHUB_REPO,
            githubUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
        };
    },
    
    mounted() {
        // 设置返回键支持
        this.$page.$npage.setSupportBack(true);
        this.$page.$npage.on("backpressed", this.handleBackPress);
    },
    
    beforeDestroy() {
        this.$page.$npage.off("backpressed", this.handleBackPress);
    },
    
    computed: {
        // 计算完整版本信息
        fullVersionInfo(): string {
            return `v${this.version} (${this.deviceModel} 型号)`;
        },
        
        // 计算完整的GitHub仓库地址
        githubFullRepo(): string {
            return `${this.githubOwner}/${this.githubRepo}`;
        }
    },
    
    methods: {
        // 处理返回键
        handleBackPress() {
            this.$page.finish();
        },
        
        // 打开GitHub页面
        openGitHub() {
            $falcon.trigger('open_url', this.githubUrl);
        },
        
        // 复制GitHub链接
        copyGitHubLink() {
            $falcon.trigger('copy_text', this.githubUrl);
        },
        
        // 导航到更新页面
        Update() {
            $falcon.navTo("update", {});
        },
        
        // 获取鸣谢文本
        getCreditsText(): string {
            return this.credits.map(c => `${c.name} (${c.role})`).join('\n');
        }
    }
});

export default about;
