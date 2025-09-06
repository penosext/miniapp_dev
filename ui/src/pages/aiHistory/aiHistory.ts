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
import { AI } from 'langningchen';
import { showError, showSuccess } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils';
import { formatTime } from '../../utils/timeUtils';

export type aiHistoryOptions = {};

const aiHistory = defineComponent({
    data() {
        return {
            $page: {} as FalconPage<aiHistoryOptions>,
            conversationList: [] as any[],
            currentConversationId: '',

            searchKeyword: '',
        };
    },

    async mounted() {
        try {
            AI.initialize();
            await this.loadConversationList();
        } catch (e) {
            showError(e as string || 'AI 初始化失败');
        }
    },

    computed: {
        filteredConversations(): any[] {
            let filtered = [...this.conversationList];
            if (this.searchKeyword) {
                const keyword = this.searchKeyword.toLowerCase();
                filtered = filtered.filter(conv => conv.title.toLowerCase().includes(keyword));
            }
            filtered.sort((a, b) => {
                return b.updatedAt - a.updatedAt;
            });
            return filtered;
        }
    },

    methods: {
        async loadConversationList() {
            showLoading();
            try {
                const list = await AI.getConversationList();
                this.conversationList = list;
                this.currentConversationId = AI.getCurrentConversationId();
            } catch (e) {
                showError(e as string || '加载对话列表失败');
            } finally {
                hideLoading();
            }
        },

        async createConversation() {
            try {
                await AI.createConversation(`新对话 ${Date.now()}`);
                await this.loadConversationList();
                this.$page.finish();
            } catch (e) {
                showError(e as string || '创建对话失败');
            }
        },

        async loadConversation(conversationId: string) {
            if (!conversationId) return;
            try {
                await AI.loadConversation(conversationId);
                this.currentConversationId = conversationId;
                this.$page.finish();
            } catch (e) {
                showError(e as string || '加载对话失败');
            }
        },

        async deleteConversation(conversationId: string) {
            if (!conversationId) return;
            try {
                await AI.deleteConversation(conversationId);
                await this.loadConversationList();
                showSuccess('对话删除成功');
                if (conversationId === this.currentConversationId) {
                    this.currentConversationId = AI.getCurrentConversationId();
                }
            } catch (e) {
                showError(e as string || '删除对话失败');
            }
        },

        editConversationTitle(conversationId: string, currentTitle: string) {
            if (!conversationId) return;
            openSoftKeyboard(
                () => currentTitle,
                async (value) => {
                    const trimmedTitle = value.trim();
                    if (trimmedTitle && trimmedTitle !== currentTitle) {
                        try {
                            await AI.updateConversationTitle(conversationId, trimmedTitle);
                            showSuccess('标题修改成功');
                            await this.loadConversationList();
                        } catch (e) {
                            showError(e as string || '修改对话标题失败');
                        }
                    }
                },
                (value) => {
                    if (!value.trim()) { return '标题不能为空'; }
                }
            );
        },

        editSearchKeyword() {
            openSoftKeyboard(
                () => this.searchKeyword,
                (value) => { this.searchKeyword = value; this.$forceUpdate(); }
            );
        },

        clearSearch() {
            this.searchKeyword = '';
            this.$forceUpdate();
        },

        formatTime,
    }
});

export default aiHistory;
