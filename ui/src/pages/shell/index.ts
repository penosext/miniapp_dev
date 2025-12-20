import { defineComponent } from 'vue';
import { Shell } from 'langningchen';

// 假设 openSoftKeyboard 从特定的工具类或全局方法中获取，根据 snippet 参考
// 如果项目中有统一的导入路径，请自行调整
declare const openSoftKeyboard: any; 

export default defineComponent({
    data() {
        return {
            shell: new Shell() as any,
            command: "",
            output: "--- Shell Ready ---\n",
            busy: false,
        };
    },

    mounted() {
        // 参考 index 页面的调用方法
        this.shell.initialize();
    },

    methods: {
        // 调用 keyboard 页面展示的功能：弹出软键盘输入命令
        openInput() {
            if (this.busy) return;
            
            openSoftKeyboard(
                () => this.command,
                (value: string) => {
                    this.command = value;
                    this.$forceUpdate();
                }
            );
        },

        // 执行命令，参考 index.ts 中的 runCommand 逻辑
        async runCommand() {
            if (!this.command || this.busy) return;

            const cmd = this.command;
            this.command = ""; // 清空当前输入
            this.busy = true;

            // 在输出窗口打印命令
            this.output += `\n$ ${cmd}\n`;

            try {
                // 调用 Shell API
                const res = await this.shell.exec(cmd);
                if (res) {
                    this.output += res + "\n";
                } else {
                    this.output += "(no output)\n";
                }
            } catch (e: any) {
                this.output += `ERROR: ${String(e)}\n`;
            } finally {
                this.busy = false;
                // 自动滚动到底部（如果容器支持）
            }
        },

        clearOutput() {
            this.output = "--- Shell Cleared ---\n";
        }
    }
});
