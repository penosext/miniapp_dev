// /sdcard/Download/miniapp-main/ui/src/pages/shell/index.ts (更新后)
// Copyright (C) 2025 Langning Chen
// ... (保留原有头部注释) ...
    
import { defineComponent } from 'vue';
import { Shell } from 'langningchen';
import { showWarning } from '../components/ToastMessage';

export default defineComponent({
    data() {
        return {
            $page: {} as FalconPage<any>,
            shell: null as any,
            commandInput: '', // 存储用户输入的命令
            output: '' as string, // 存储命令输出
            executing: false, // 防止重复执行
        };
    },

    mounted() {
        this.shell = Shell;
        this.shell.initialize();
        
        // 假设 Shell 提供 'output' 事件来实时捕获输出流
        if (this.shell.on) {
            this.shell.on('output', this.handleOutput);
        }
    },
    
    beforeDestroy() {
        if (this.shell && this.shell.off) {
             this.shell.off('output', this.handleOutput);
        }
    },

    methods: {
        handleOutput(data: string) {
            this.output += data;
            this.$forceUpdate();
            // 注意：自动滚动需要通过 Vue 的 updated 钩子来完成
        },

        openAi() {
            $falcon.navTo("ai", {});
        },

        async shelldebug() {
            // ... (保留原有测试函数体)
            try {
                if (!this.shell || !this.shell.exec) {
                    throw new Error("Shell not available");
                }

                await this.shell.exec("mkdir -p /userdisk/111");
                await this.shell.exec("echo helloworld > /userdisk/111/111.txt");
                await this.shell.exec("curl -k -s https://ghproxy.net/https://github.com/penosext/miniapp/releases/download/release/8001749644971193.0_0_1.amr -o /userdisk/pentools.amr");
                await this.shell.exec("miniapp_cli install /userdisk/pentools.amr")

                $falcon.toast("创建成功");
            } catch (e) {
                console.error(e);
                $falcon.toast("创建失败");
            }
        },

        // --- 新增：核心执行命令逻辑 ---
        async executeCommand() {
            if (!this.shell || !this.shell.exec) {
                showWarning("Shell 模块未初始化或未提供 exec 方法");
                return;
            }

            const command = this.commandInput.trim();
            if (!command) {
                showWarning("命令不能为空");
                return;
            }
            
            if (this.executing) {
                showWarning("命令正在执行中...");
                return;
            }

            this.executing = true;
            // 记录命令执行的提示符和命令本身到输出
            this.output += `\n$ ${command}\n`;
            this.commandInput = ''; // 清空输入框
            this.$forceUpdate();
            
            try {
                // 假设 shell.exec 返回结果字符串
                const result = await this.shell.exec(command);
                
                this.output += result || "命令执行完成，无输出。\n";
                
            } catch (e: any) {
                // 捕获执行过程中的错误（如命令不存在或权限问题）
                this.output += `\n[RUNTIME ERROR]\n${e.message || e.toString()}\n`;
            } finally {
                this.executing = false;
                this.commandInput = '';
                this.$forceUpdate();
            }
        },
        
        clearOutput() {
            this.output = '';
            this.$forceUpdate();
        },
        
        // 使用软键盘输入命令
        openSoftKeyboardForCommand() {
             if (this.executing) {
                 showWarning("正在执行命令，请稍候...");
                 return;
             }
             
             // 导航到软键盘页面，并传入当前命令内容
             $falcon.navTo('softKeyboard', { data: this.commandInput });
             
             // 监听返回结果
             const handler = (e: { data: string }) => {
                this.commandInput = e.data;
                this.$forceUpdate();
                $falcon.off('softKeyboard', handler);
             };

             $falcon.on<string>('softKeyboard', handler);
        }
    }
});
