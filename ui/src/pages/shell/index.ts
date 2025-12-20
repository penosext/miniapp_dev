import { defineComponent } from 'vue';
import { Shell } from 'langningchen';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils'; 

export default defineComponent({
    data() {
        return {
            shell: Shell, // 直接使用已经实例化的Shell对象
            command: "",
            output: "--- Shell Ready ---\n",
            busy: false,
        };
    },

    mounted() {
        setTimeout(() => {
            this.shell.initialize();
            console.log("Shell after initialization:", this.shell);
            console.log("Shell exec method exists:", typeof this.shell.exec === "function");
        }, 1000);
    },

    methods: {
        openInput() {
            if (this.busy) return;
            
            openSoftKeyboard(
                () => this.command, // 获取当前值
                (value: string) => { // 设置新值
                    this.command = value;
                    this.$forceUpdate();
                }
            );
        },

        async runCommand() {
            if (!this.command || this.busy) return;

            const cmd = this.command;
            this.command = ""; 
            this.busy = true;

            this.output += `\n$ ${cmd}\n`;

            try {
                const res = await this.shell.exec(cmd);
                this.output += (res || "(no output)") + "\n";
            } catch (e: any) {
                this.output += `ERROR: ${String(e)}\n`;
            } finally {
                this.busy = false;
            }
        },

        clearOutput() {
            this.output = "--- Shell Cleared ---\n";
        }
    }
});
