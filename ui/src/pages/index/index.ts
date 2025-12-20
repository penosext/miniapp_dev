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

export default defineComponent({
    data() {
        return {
            $page: {} as FalconPage<any>,
            shell: null as any,

            // ✅ 必须提前声明
            output: "",        // shell 输出
            error: "",         // 错误信息
        };
    },

    mounted() {
        this.shell = Shell;
        this.shell.initialize();
    },

    methods: {
        async shelldebug() {
            try {
                this.error = "";
                this.output = "执行中...\n";

                const out = await this.shell.exec("echo HELLO_FROM_SHELL");
                this.output += out;
            } catch (e: any) {
                this.error = String(e);
            }
        }
    }
});
